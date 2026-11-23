import { test, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import {
  encryptToken,
  decryptToken,
  isEncrypted,
  getEncryptionKeyBuffer,
  encryptUserTokens,
  decryptUserTokens
} from '../src/services/tokenEncryptionService.js';

describe('Token Encryption Service (AES-256-GCM)', () => {
  const testKeyHex = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const testPlaintext = 'ya29.a0AfH6SMDh_SampleGoogleAccessToken12345';
  const testRefreshToken = '1//04SampleGoogleRefreshToken_LongString98765';

  it('correctly validates and parses a 64-character hex key', () => {
    const keyBuf = getEncryptionKeyBuffer(testKeyHex);
    assert.strictEqual(Buffer.isBuffer(keyBuf), true);
    assert.strictEqual(keyBuf.length, 32);
    assert.strictEqual(keyBuf.toString('hex'), testKeyHex);
  });

  it('correctly accepts a 32-character raw UTF-8 key', () => {
    const rawKey = '12345678901234567890123456789012'; // exactly 32 bytes
    const keyBuf = getEncryptionKeyBuffer(rawKey);
    assert.strictEqual(keyBuf.length, 32);
  });

  it('correctly accepts a 44-character base64 key', () => {
    const base64Key = Buffer.alloc(32, 0x5a).toString('base64');
    const keyBuf = getEncryptionKeyBuffer(base64Key);
    assert.strictEqual(keyBuf.length, 32);
  });

  it('rejects keys with invalid lengths', () => {
    assert.throws(() => {
      getEncryptionKeyBuffer('too-short-key');
    }, /must resolve to exactly 32 bytes/);

    assert.throws(() => {
      getEncryptionKeyBuffer('1234567890123456789012345678901234567890'); // 40 chars
    }, /must resolve to exactly 32 bytes/);
  });

  it('encrypts a plaintext token into the enc:v1 format', () => {
    const encrypted = encryptToken(testPlaintext, testKeyHex);
    assert.strictEqual(typeof encrypted, 'string');
    assert.strictEqual(encrypted.startsWith('enc:v1:'), true);
    assert.strictEqual(isEncrypted(encrypted), true);

    const parts = encrypted.split(':');
    assert.strictEqual(parts.length, 5); // ['enc', 'v1', iv, tag, ciphertext]
    assert.strictEqual(parts[2].length, 24); // 12-byte IV in hex = 24 chars
    assert.strictEqual(parts[3].length, 32); // 16-byte authTag in hex = 32 chars
    assert.ok(parts[4].length > 0);
  });

  it('decrypts an encrypted token to recover original plaintext', () => {
    const encrypted = encryptToken(testPlaintext, testKeyHex);
    const decrypted = decryptToken(encrypted, testKeyHex);
    assert.strictEqual(decrypted, testPlaintext);
  });

  it('produces unique ciphertexts for identical plaintext (probabilistic IV)', () => {
    const enc1 = encryptToken(testPlaintext, testKeyHex);
    const enc2 = encryptToken(testPlaintext, testKeyHex);
    assert.notStrictEqual(enc1, enc2);
    assert.strictEqual(decryptToken(enc1, testKeyHex), testPlaintext);
    assert.strictEqual(decryptToken(enc2, testKeyHex), testPlaintext);
  });

  it('maintains safe backward compatibility with legacy plaintext tokens', () => {
    // A legacy token that is not encrypted
    const legacyToken = 'ya29.legacy_unencrypted_plaintext_token';
    assert.strictEqual(isEncrypted(legacyToken), false);

    // Decrypting legacy token must return plaintext untouched
    const result = decryptToken(legacyToken, testKeyHex);
    assert.strictEqual(result, legacyToken);
  });

  it('is idempotent and prevents double-encryption', () => {
    const encryptedOnce = encryptToken(testPlaintext, testKeyHex);
    const encryptedTwice = encryptToken(encryptedOnce, testKeyHex);
    assert.strictEqual(encryptedOnce, encryptedTwice);
    assert.strictEqual(decryptToken(encryptedTwice, testKeyHex), testPlaintext);
  });

  it('throws an authentication error if the ciphertext is tampered with', () => {
    const encrypted = encryptToken(testPlaintext, testKeyHex);
    const parts = encrypted.split(':');
    // Tamper with last character of ciphertext
    const tamperedCipher = parts[4].slice(0, -2) + (parts[4].endsWith('a') ? 'b' : 'a');
    const tampered = `enc:v1:${parts[2]}:${parts[3]}:${tamperedCipher}`;

    assert.throws(() => {
      decryptToken(tampered, testKeyHex);
    }, /authentication tag verification failed/);
  });

  it('throws an authentication error if the auth tag is tampered with', () => {
    const encrypted = encryptToken(testPlaintext, testKeyHex);
    const parts = encrypted.split(':');
    const tamperedTag = (parts[3].startsWith('0') ? '1' : '0') + parts[3].slice(1);
    const tampered = `enc:v1:${parts[2]}:${tamperedTag}:${parts[4]}`;

    assert.throws(() => {
      decryptToken(tampered, testKeyHex);
    }, /authentication tag verification failed/);
  });

  it('encrypts and decrypts user token bundles correctly', () => {
    const userTokens = {
      accessToken: testPlaintext,
      refreshToken: testRefreshToken,
      expiryDate: 1700000000000
    };

    const encryptedBundle = encryptUserTokens(userTokens, testKeyHex);
    assert.ok(isEncrypted(encryptedBundle.accessToken));
    assert.ok(isEncrypted(encryptedBundle.refreshToken));
    assert.strictEqual(encryptedBundle.expiryDate, 1700000000000);

    const decryptedBundle = decryptUserTokens(encryptedBundle, testKeyHex);
    assert.strictEqual(decryptedBundle.accessToken, testPlaintext);
    assert.strictEqual(decryptedBundle.refreshToken, testRefreshToken);
    assert.strictEqual(decryptedBundle.expiryDate, 1700000000000);
  });

  it('gracefully handles null or missing tokens', () => {
    assert.strictEqual(encryptToken(null, testKeyHex), null);
    assert.strictEqual(encryptToken(undefined, testKeyHex), undefined);
    assert.strictEqual(decryptToken(null, testKeyHex), null);
    assert.strictEqual(decryptToken(undefined, testKeyHex), undefined);
  });
});

import crypto from 'crypto';
import { config } from '../config/env.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV recommended for AES-GCM
const PREFIX = 'enc:v1:';

/**
 * Resolves and validates the 32-byte encryption key from environment variables.
 * Supports:
 * - 64-character hex string (recommended)
 * - 32-character utf8 string
 * - 44-character base64 string
 *
 * @param {string|Buffer} [overrideKey] - Optional override key (primarily for unit tests)
 * @returns {Buffer} 32-byte key buffer
 */
export function getEncryptionKeyBuffer(overrideKey) {
  const rawKey = overrideKey || config.tokenEncryptionKey || process.env.TOKEN_ENCRYPTION_KEY;

  if (!rawKey) {
    if (config.isProduction || process.env.NODE_ENV === 'production') {
      throw new Error(
        '[Security] FATAL: TOKEN_ENCRYPTION_KEY environment variable is required in production.'
      );
    }
    throw new Error(
      '[Security] Missing TOKEN_ENCRYPTION_KEY environment variable. ' +
      'Please generate a 32-byte hex key using: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }

  if (Buffer.isBuffer(rawKey)) {
    if (rawKey.length !== 32) {
      throw new Error(`[Security] TOKEN_ENCRYPTION_KEY buffer must be exactly 32 bytes, got ${rawKey.length}`);
    }
    return rawKey;
  }

  if (typeof rawKey !== 'string') {
    throw new Error('[Security] TOKEN_ENCRYPTION_KEY must be a string or Buffer');
  }

  const trimmed = rawKey.trim();
  let keyBuffer;

  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    keyBuffer = Buffer.from(trimmed, 'hex');
  } else if (/^[A-Za-z0-9+/=]{44}$/.test(trimmed)) {
    keyBuffer = Buffer.from(trimmed, 'base64');
  } else if (Buffer.byteLength(trimmed, 'utf8') === 32) {
    keyBuffer = Buffer.from(trimmed, 'utf8');
  } else {
    throw new Error(
      `[Security] TOKEN_ENCRYPTION_KEY must resolve to exactly 32 bytes (256 bits). ` +
      `Provided key has length ${trimmed.length}. Expected a 64-char hex, 44-char base64, or 32-byte string.`
    );
  }

  if (keyBuffer.length !== 32) {
    throw new Error(`[Security] Derived key buffer is ${keyBuffer.length} bytes; expected 32 bytes.`);
  }

  return keyBuffer;
}

/**
 * Checks whether a given token string is already encrypted in the enc:v1 format.
 *
 * @param {string} token
 * @returns {boolean}
 */
export function isEncrypted(token) {
  if (typeof token !== 'string') return false;
  return token.startsWith(PREFIX);
}

/**
 * Encrypts a plaintext token using AES-256-GCM.
 * If the token is null, empty, or already encrypted, it is returned without alteration.
 *
 * @param {string} plaintext - Plaintext token string
 * @param {string|Buffer} [customKey] - Optional override key for testing
 * @returns {string} Serialized ciphertext in format `enc:v1:<iv_hex>:<tag_hex>:<ciphertext_hex>`
 */
export function encryptToken(plaintext, customKey) {
  if (!plaintext || typeof plaintext !== 'string') {
    return plaintext;
  }

  // Idempotent: do not double-encrypt
  if (isEncrypted(plaintext)) {
    return plaintext;
  }

  const key = getEncryptionKeyBuffer(customKey);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
  ciphertext += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return `${PREFIX}${iv.toString('hex')}:${authTag}:${ciphertext}`;
}

/**
 * Decrypts an encrypted token string using AES-256-GCM.
 * Safe migration: If the token is not encrypted (legacy plaintext token),
 * it returns the token as-is without failing, maintaining 100% backward compatibility.
 *
 * @param {string} encryptedOrPlaintext - Stored token string
 * @param {string|Buffer} [customKey] - Optional override key for testing
 * @returns {string} Plaintext token
 */
export function decryptToken(encryptedOrPlaintext, customKey) {
  if (!encryptedOrPlaintext || typeof encryptedOrPlaintext !== 'string') {
    return encryptedOrPlaintext;
  }

  // Backward compatibility: If not encrypted, return legacy plaintext token
  if (!isEncrypted(encryptedOrPlaintext)) {
    return encryptedOrPlaintext;
  }

  const parts = encryptedOrPlaintext.split(':');
  // Format is: ['enc', 'v1', ivHex, tagHex, cipherHex]
  if (parts.length !== 5 || parts[0] !== 'enc' || parts[1] !== 'v1') {
    throw new Error('[Security] Invalid encrypted token format');
  }

  const iv = Buffer.from(parts[2], 'hex');
  const authTag = Buffer.from(parts[3], 'hex');
  const ciphertext = parts[4];

  if (iv.length !== IV_LENGTH) {
    throw new Error('[Security] Invalid IV length in encrypted token');
  }

  if (authTag.length !== 16) {
    throw new Error('[Security] Invalid authentication tag length in encrypted token');
  }

  const key = getEncryptionKeyBuffer(customKey);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  try {
    let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    // Never expose token or key in error message
    throw new Error('[Security] Failed to decrypt token: authentication tag verification failed');
  }
}

/**
 * Encrypts all token fields in a googleTokens object.
 *
 * @param {Object} googleTokens - User tokens object { accessToken, refreshToken, expiryDate }
 * @param {string|Buffer} [customKey]
 * @returns {Object} googleTokens with encrypted accessToken and refreshToken
 */
export function encryptUserTokens(googleTokens, customKey) {
  if (!googleTokens) return googleTokens;

  return {
    accessToken: encryptToken(googleTokens.accessToken, customKey),
    refreshToken: googleTokens.refreshToken ? encryptToken(googleTokens.refreshToken, customKey) : googleTokens.refreshToken,
    expiryDate: googleTokens.expiryDate
  };
}

/**
 * Decrypts all token fields in a googleTokens object for API client use in memory.
 *
 * @param {Object} googleTokens - User tokens object { accessToken, refreshToken, expiryDate }
 * @param {string|Buffer} [customKey]
 * @returns {Object} googleTokens with decrypted accessToken and refreshToken
 */
export function decryptUserTokens(googleTokens, customKey) {
  if (!googleTokens) return googleTokens;

  return {
    accessToken: decryptToken(googleTokens.accessToken, customKey),
    refreshToken: googleTokens.refreshToken ? decryptToken(googleTokens.refreshToken, customKey) : googleTokens.refreshToken,
    expiryDate: googleTokens.expiryDate
  };
}

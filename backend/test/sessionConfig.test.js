import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/config/env.js';

describe('Production Session & Security Middleware Configuration', () => {
  it('sanitizes frontendUrl by removing trailing slashes to prevent CORS mismatches', () => {
    assert.strictEqual(config.frontendUrl.endsWith('/'), false);
    assert.strictEqual(typeof config.frontendUrl, 'string');
    assert.ok(config.frontendUrl.startsWith('http'));
  });

  it('configures session secrets and database connection strings properly', () => {
    assert.ok(config.sessionSecret);
    assert.ok(config.mongodbUri);
  });

  it('configures trust proxy appropriately for the environment', () => {
    assert.strictEqual(typeof config.trustProxy, 'number');
  });

  it('properly configures tokenEncryptionKey from environment', () => {
    assert.ok(config.tokenEncryptionKey);
    assert.strictEqual(typeof config.tokenEncryptionKey, 'string');
  });
});

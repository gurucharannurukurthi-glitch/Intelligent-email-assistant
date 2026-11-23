import { test, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { getAuthorizationUrl } from '../src/services/googleAuthService.js';
import { googleLogin, googleCallback } from '../src/controllers/authController.js';
import { config } from '../src/config/env.js';

describe('OAuth Security & CSRF State Protection', () => {
  it('requires a state parameter when generating the authorization URL', () => {
    assert.throws(() => {
      getAuthorizationUrl();
    }, /state parameter is required/);

    assert.throws(() => {
      getAuthorizationUrl('');
    }, /state parameter is required/);
  });

  it('includes the provided state parameter in the authorization URL', () => {
    const testState = 'c0ffee1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
    const authUrl = getAuthorizationUrl(testState);

    assert.ok(authUrl.startsWith('https://accounts.google.com/o/oauth2/v2/auth'));
    const url = new URL(authUrl);
    assert.strictEqual(url.searchParams.get('state'), testState);
    assert.strictEqual(url.searchParams.get('access_type'), 'offline');
    assert.strictEqual(url.searchParams.get('prompt'), 'consent');
  });

  it('googleLogin generates random state, saves session, and redirects with state', () => {
    let saved = false;
    let redirectedUrl = '';

    const req = {
      session: {
        save: (cb) => {
          saved = true;
          cb(null);
        }
      }
    };

    const res = {
      redirect: (url) => {
        redirectedUrl = url;
      }
    };

    googleLogin(req, res);

    assert.strictEqual(saved, true);
    assert.ok(req.session.oauthState);
    assert.strictEqual(typeof req.session.oauthState, 'string');
    assert.strictEqual(req.session.oauthState.length, 64); // 32 bytes in hex
    assert.ok(req.session.oauthStateCreatedAt <= Date.now());

    const url = new URL(redirectedUrl);
    assert.strictEqual(url.searchParams.get('state'), req.session.oauthState);
  });

  it('googleCallback rejects missing state with invalid_state error', async () => {
    let redirectedUrl = '';
    const req = {
      query: { code: 'sample_code' },
      session: {
        oauthState: 'valid_session_state',
        oauthStateCreatedAt: Date.now()
      }
    };
    const res = {
      redirect: (url) => {
        redirectedUrl = url;
      }
    };

    await googleCallback(req, res);

    assert.ok(redirectedUrl.includes('error=invalid_state'));
    // State must be cleared to prevent reuse
    assert.strictEqual(req.session.oauthState, undefined);
  });

  it('googleCallback rejects missing session state with invalid_state error', async () => {
    let redirectedUrl = '';
    const req = {
      query: { code: 'sample_code', state: 'incoming_state' },
      session: {}
    };
    const res = {
      redirect: (url) => {
        redirectedUrl = url;
      }
    };

    await googleCallback(req, res);

    assert.ok(redirectedUrl.includes('error=invalid_state'));
  });

  it('googleCallback rejects mismatched state with invalid_state error', async () => {
    let redirectedUrl = '';
    const req = {
      query: { code: 'sample_code', state: 'attacker_forged_state' },
      session: {
        oauthState: 'legitimate_session_state',
        oauthStateCreatedAt: Date.now()
      }
    };
    const res = {
      redirect: (url) => {
        redirectedUrl = url;
      }
    };

    await googleCallback(req, res);

    assert.ok(redirectedUrl.includes('error=invalid_state'));
    // State must be destroyed
    assert.strictEqual(req.session.oauthState, undefined);
  });

  it('googleCallback rejects expired state with state_expired error', async () => {
    let redirectedUrl = '';
    const expiredTimestamp = Date.now() - (11 * 60 * 1000); // 11 minutes ago (> 10m TTL)
    const matchingState = 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';

    const req = {
      query: { code: 'sample_code', state: matchingState },
      session: {
        oauthState: matchingState,
        oauthStateCreatedAt: expiredTimestamp
      }
    };
    const res = {
      redirect: (url) => {
        redirectedUrl = url;
      }
    };

    await googleCallback(req, res);

    assert.ok(redirectedUrl.includes('error=state_expired'));
    assert.strictEqual(req.session.oauthState, undefined);
  });

  it('googleCallback cleanly handles consent denial error parameter from Google', async () => {
    let redirectedUrl = '';
    const req = {
      query: { error: 'access_denied', state: 'some_state' },
      session: {
        oauthState: 'some_state',
        oauthStateCreatedAt: Date.now()
      }
    };
    const res = {
      redirect: (url) => {
        redirectedUrl = url;
      }
    };

    await googleCallback(req, res);

    assert.ok(redirectedUrl.includes('error=access_denied'));
    assert.strictEqual(req.session.oauthState, undefined);
  });
});

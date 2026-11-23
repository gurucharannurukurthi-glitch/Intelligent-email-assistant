import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/config/env.js';

describe('OAuth Scope Minimization & Least Privilege', () => {
  it('requests the minimal set of 4 necessary scopes', () => {
    const expectedScopes = [
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile'
    ];

    assert.strictEqual(config.google.scopes.length, 4);
    expectedScopes.forEach((scope) => {
      assert.ok(config.google.scopes.includes(scope), `Missing expected scope: ${scope}`);
    });
  });

  it('does NOT include redundant gmail.readonly scope', () => {
    assert.strictEqual(
      config.google.scopes.includes('https://www.googleapis.com/auth/gmail.readonly'),
      false,
      'gmail.readonly is redundant with gmail.modify and must not be requested'
    );
  });

  it('does NOT include redundant gmail.send scope', () => {
    assert.strictEqual(
      config.google.scopes.includes('https://www.googleapis.com/auth/gmail.send'),
      false,
      'gmail.send is redundant with gmail.modify and must not be requested'
    );
  });

  it('preserves the only restricted scope required (gmail.modify)', () => {
    assert.ok(
      config.google.scopes.includes('https://www.googleapis.com/auth/gmail.modify'),
      'gmail.modify is required to read, modify, and send emails'
    );
  });

  it('preserves sensitive calendar scope (calendar.events)', () => {
    assert.ok(
      config.google.scopes.includes('https://www.googleapis.com/auth/calendar.events'),
      'calendar.events is required to create calendar events'
    );
  });
});

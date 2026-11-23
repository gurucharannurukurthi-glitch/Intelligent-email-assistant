import { google } from 'googleapis';
import { config } from '../config/env.js';
import { User } from '../models/User.js';
import {
  encryptToken,
  decryptToken,
  isEncrypted
} from './tokenEncryptionService.js';

export function createOAuth2Client() {
  return new google.auth.OAuth2(
    config.google.clientId,
    config.google.clientSecret,
    config.google.redirectUri
  );
}

/**
 * Generates Google OAuth consent screen authorization URL.
 * Includes cryptographically secure random state parameter for CSRF mitigation.
 *
 * @param {string} state - Cryptographically random state parameter
 * @returns {string} Google authorization URL
 */
export function getAuthorizationUrl(state) {
  if (!config.google.clientId || !config.google.clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing. Please configure backend/.env with your Google Cloud credentials.');
  }

  if (!state || typeof state !== 'string') {
    throw new Error('OAuth state parameter is required for CSRF protection.');
  }

  const oauth2Client = createOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: config.google.scopes,
    state
  });
}

/**
 * Exchanges the Google authorization code for tokens, retrieves profile,
 * and saves/updates user in MongoDB with tokens encrypted at rest via AES-256-GCM.
 *
 * @param {string} code - Google authorization code
 * @returns {Promise<Object>} Mongoose User document
 */
export async function handleGoogleCallback(code) {
  const oauth2Client = createOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
  const { data: profile } = await oauth2.userinfo.get();

  if (!profile || !profile.email) {
    throw new Error('Failed to retrieve user profile from Google');
  }

  let user = await User.findOne({ googleId: profile.id });

  // Encrypt tokens before storing in database
  const encryptedAccessToken = encryptToken(tokens.access_token);
  const encryptedRefreshToken = tokens.refresh_token ? encryptToken(tokens.refresh_token) : null;

  const tokenUpdate = {
    accessToken: encryptedAccessToken,
    expiryDate: tokens.expiry_date
  };

  if (encryptedRefreshToken) {
    tokenUpdate.refreshToken = encryptedRefreshToken;
  }

  if (user) {
    user.name = profile.name || user.name;
    user.picture = profile.picture || user.picture;
    user.email = profile.email.toLowerCase();

    // Preserve existing refresh token if Google didn't return one (common on re-login)
    let currentRefreshToken = tokenUpdate.refreshToken || user.googleTokens?.refreshToken;
    // Migrate existing refresh token to encrypted format if legacy plaintext
    if (currentRefreshToken && !isEncrypted(currentRefreshToken)) {
      currentRefreshToken = encryptToken(currentRefreshToken);
    }

    user.googleTokens = {
      accessToken: tokenUpdate.accessToken,
      refreshToken: currentRefreshToken,
      expiryDate: tokenUpdate.expiryDate
    };
    await user.save();
  } else {
    user = await User.create({
      googleId: profile.id,
      email: profile.email.toLowerCase(),
      name: profile.name || '',
      picture: profile.picture || '',
      googleTokens: tokenUpdate
    });
  }

  return user;
}

/**
 * Initializes and returns an authenticated OAuth2 client for Google API calls.
 * Decrypts tokens in memory only. If existing stored tokens are legacy plaintext,
 * transparently migrates them to encrypted tokens at rest in MongoDB without disrupting user.
 *
 * @param {Object} user - Mongoose User document
 * @returns {Promise<google.auth.OAuth2>} Configured OAuth2 client
 */
export async function getAuthenticatedOAuth2Client(user) {
  if (!user || !user.googleTokens) {
    throw new Error('User has no valid Google authentication tokens');
  }

  const { accessToken, refreshToken, expiryDate } = user.googleTokens;

  // Safe migration check: If tokens are stored in plaintext, upgrade them in the background
  const hasPlaintextAccess = accessToken && !isEncrypted(accessToken);
  const hasPlaintextRefresh = refreshToken && !isEncrypted(refreshToken);

  if (hasPlaintextAccess || hasPlaintextRefresh) {
    const update = {};
    if (hasPlaintextAccess) {
      update['googleTokens.accessToken'] = encryptToken(accessToken);
    }
    if (hasPlaintextRefresh) {
      update['googleTokens.refreshToken'] = encryptToken(refreshToken);
    }

    // Perform non-blocking background migration in database
    User.findByIdAndUpdate(user._id, { $set: update }).catch((err) => {
      console.error('[OAuth2] Background token encryption migration failed:', err.message);
    });
  }

  // Decrypt tokens for in-memory Google API client initialization
  const decryptedAccessToken = decryptToken(accessToken);
  const decryptedRefreshToken = decryptToken(refreshToken);

  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({
    access_token: decryptedAccessToken,
    refresh_token: decryptedRefreshToken,
    expiry_date: expiryDate
  });

  // Listen for automatic token refresh and persist encrypted in database
  oauth2Client.on('tokens', async (newTokens) => {
    try {
      const updateData = {
        'googleTokens.accessToken': encryptToken(newTokens.access_token),
        'googleTokens.expiryDate': newTokens.expiry_date
      };
      if (newTokens.refresh_token) {
        updateData['googleTokens.refreshToken'] = encryptToken(newTokens.refresh_token);
      }
      await User.findByIdAndUpdate(user._id, { $set: updateData });
    } catch (err) {
      console.error('[OAuth2] Error updating refreshed tokens in MongoDB:', err.message);
    }
  });

  return oauth2Client;
}

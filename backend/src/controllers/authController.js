import crypto from 'crypto';
import { getAuthorizationUrl, handleGoogleCallback } from '../services/googleAuthService.js';
import { config } from '../config/env.js';

// State expiration time: 10 minutes (600,000 ms)
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

export function googleLogin(req, res, next) {
  try {
    // Generate cryptographically secure random 32-byte hex state
    const state = crypto.randomBytes(32).toString('hex');

    // Store state and timestamp in user session
    req.session.oauthState = state;
    req.session.oauthStateCreatedAt = Date.now();

    // Persist session before redirecting user to Google
    req.session.save((err) => {
      if (err) {
        console.error('[GoogleLogin] Error saving session state:', err);
        return res.redirect(`${config.frontendUrl}/login?error=session_error`);
      }
      const authUrl = getAuthorizationUrl(state);
      res.redirect(authUrl);
    });
  } catch (error) {
    console.error('[GoogleLogin] Initialization error:', error.message);
    res.redirect(`${config.frontendUrl}/login?error=${encodeURIComponent(error.message)}`);
  }
}

export async function googleCallback(req, res, next) {
  const { code, state, error } = req.query;

  // Retrieve stored state and timestamp from session
  const sessionState = req.session?.oauthState;
  const sessionStateCreatedAt = req.session?.oauthStateCreatedAt;

  // Immediately destroy state in session to prevent replay attacks
  if (req.session) {
    delete req.session.oauthState;
    delete req.session.oauthStateCreatedAt;
  }

  // Handle user cancellation or errors from Google consent screen
  if (error) {
    console.warn('[GoogleCallback] Received OAuth error parameter from Google:', error);
    return res.redirect(`${config.frontendUrl}/login?error=${encodeURIComponent(error)}`);
  }

  // Missing authorization code
  if (!code) {
    return res.redirect(`${config.frontendUrl}/login?error=missing_code`);
  }

  // OAuth CSRF Protection: Validate state
  if (!state || !sessionState || state !== sessionState) {
    console.error('[GoogleCallback] OAuth state mismatch or missing');
    return res.redirect(`${config.frontendUrl}/login?error=invalid_state`);
  }

  // State expiration check
  if (!sessionStateCreatedAt || Date.now() - sessionStateCreatedAt > OAUTH_STATE_TTL_MS) {
    console.error('[GoogleCallback] OAuth state expired');
    return res.redirect(`${config.frontendUrl}/login?error=state_expired`);
  }

  try {
    const user = await handleGoogleCallback(code);
    req.session.userId = user._id;

    // Save session explicitly before redirecting to dashboard
    req.session.save((err) => {
      if (err) {
        console.error('[SessionSave] Error saving session:', err);
        return next(err);
      }
      res.redirect(`${config.frontendUrl}/dashboard`);
    });
  } catch (err) {
    console.error('[GoogleCallback] Auth error:', err.message);
    res.redirect(`${config.frontendUrl}/login?error=auth_failed`);
  }
}

export function getMe(req, res) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized', message: 'No active session' });
  }
  res.json({ user: req.user });
}

export function logout(req, res, next) {
  req.session.destroy((err) => {
    if (err) {
      return next(err);
    }
    const cookieOptions = {
      httpOnly: true,
      secure: config.isProduction,
      sameSite: config.isProduction ? 'none' : 'lax'
    };
    if (config.cookieDomain) {
      cookieOptions.domain = config.cookieDomain;
    }
    res.clearCookie('connect.sid', cookieOptions);
    res.json({ success: true, message: 'Logged out successfully' });
  });
}

export function errorHandler(err, req, res, next) {
  console.error('[Error Handler]', err);

  // Surface expired/invalid Google OAuth tokens cleanly
  const isGoogleAuthError =
    err.message?.includes('invalid_grant') ||
    err.message?.includes('Invalid Credentials') ||
    err.code === 401 ||
    err.status === 401 ||
    err.response?.data?.error === 'invalid_grant';

  if (isGoogleAuthError) {
    return res.status(401).json({
      error: 'GoogleAuthExpired',
      message: 'Your Google session has expired or permissions were revoked. Please reconnect your Gmail account.',
      requiresReauth: true
    });
  }

  const statusCode = err.statusCode || err.status || 500;
  res.status(statusCode).json({
    error: err.name || 'InternalServerError',
    message: err.message || 'An unexpected error occurred. Please try again later.'
  });
}

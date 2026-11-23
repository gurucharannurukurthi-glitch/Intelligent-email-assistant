import { User } from '../models/User.js';

export async function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required. Please connect your Gmail account.'
    });
  }

  try {
    const user = await User.findById(req.session.userId);
    if (!user) {
      req.session.destroy(() => {});
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User session invalid. Please log in again.'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

import jwt from 'jsonwebtoken';
import User from '../models/User.js';

/**
 * Middleware to authenticate JWT token
 * Verifies token and attaches user to request
 */
export const authenticateToken = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    // Get user from database
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token. User not found.'
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated.'
      });
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({
        success: false,
        message: 'Invalid token.'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired. Please login again.'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Authentication failed.',
      error: error.message
    });
  }
};

/**
 * Middleware to authorize specific roles
 * @param  {...string} allowedRoles - Roles allowed to access the route
 */
export const authorizeRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${allowedRoles.join(' or ')}. Your role: ${req.user.role}`
      });
    }

    next();
  };
};

/**
 * Optional authentication - doesn't fail if no token
 * Useful for routes that work differently for authenticated users
 */
export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      const user = await User.findById(decoded.id).select('-password');
      if (user && user.isActive) {
        req.user = user;
      }
    }
  } catch (error) {
    // Silently fail - authentication is optional
  }
  next();
};

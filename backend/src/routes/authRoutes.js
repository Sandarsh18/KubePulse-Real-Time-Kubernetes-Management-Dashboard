import express from 'express';
import { body } from 'express-validator';
import {
  signup,
  login,
  getMe,
  logout,
  getAllUsers,
  updateUserRole,
  deleteUser
} from '../controllers/authController.js';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';

const router = express.Router();

// Validation middleware
const signupValidation = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),
  body('email')
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  body('role')
    .optional()
    .isIn(['admin', 'viewer'])
    .withMessage('Role must be either admin or viewer')
];

const loginValidation = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

// Public routes
/**
 * @route   POST /api/auth/signup
 * @desc    Register a new user
 * @access  Public
 */
router.post('/signup', signupValidation, signup);

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post('/login', loginValidation, login);

// Protected routes (require authentication)
/**
 * @route   GET /api/auth/me
 * @desc    Get current logged-in user info
 * @access  Private
 */
router.get('/me', authenticateToken, getMe);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post('/logout', authenticateToken, logout);

// Admin-only routes
/**
 * @route   GET /api/auth/users
 * @desc    Get all users (Admin only)
 * @access  Private/Admin
 */
router.get('/users', authenticateToken, authorizeRole('admin'), getAllUsers);

/**
 * @route   PATCH /api/auth/users/:id/role
 * @desc    Update user role (Admin only)
 * @access  Private/Admin
 */
router.patch(
  '/users/:id/role',
  authenticateToken,
  authorizeRole('admin'),
  body('role').isIn(['admin', 'viewer']).withMessage('Role must be either admin or viewer'),
  updateUserRole
);

/**
 * @route   DELETE /api/auth/users/:id
 * @desc    Delete user (Admin only)
 * @access  Private/Admin
 */
router.delete('/users/:id', authenticateToken, authorizeRole('admin'), deleteUser);

export default router;

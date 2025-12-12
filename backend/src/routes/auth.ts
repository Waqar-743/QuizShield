import express from 'express';
import { register, login, getCurrentUser, updateProfile, switchRole } from '../controllers/authController';
import { protect } from '../middleware/auth';

const router = express.Router();

// Public routes
router.post('/register', register);
router.post('/login', login);

// Protected routes
router.get('/me', protect, getCurrentUser);
router.put('/profile', protect, updateProfile);
router.put('/switch-role', protect, switchRole);

export default router;

import express from 'express';
import multer from 'multer';
import { register, login, getCurrentUser, updateProfile, switchRole, verifyFaceLogin } from '../controllers/authController';
import { uploadProfilePicture, uploadRegistrationPicture } from '../controllers/profilePictureController';
import { protect } from '../middleware/auth';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/jpg'].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG and PNG images are allowed'));
    }
  },
});

const router = express.Router();

// Public routes
router.post('/register', register);
router.post('/login', login);
router.post('/validate-picture', upload.single('profilePicture'), uploadRegistrationPicture);
router.post('/verify-face-login', verifyFaceLogin);

// Protected routes
router.get('/me', protect, getCurrentUser);
router.put('/profile', protect, updateProfile);
router.put('/switch-role', protect, switchRole);
router.post('/upload-profile-picture', protect, upload.single('profilePicture'), uploadProfilePicture);

export default router;

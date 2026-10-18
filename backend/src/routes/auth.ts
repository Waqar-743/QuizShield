import express from 'express';
import multer from 'multer';
import { register, login, forgotPassword, resetPassword, getCurrentUser, updateProfile } from '../controllers/authController';
import { uploadProfilePicture } from '../controllers/profilePictureController';
import { protect } from '../middleware/auth';
import { supabase } from '../config/supabase';
import { asyncHandler } from '../middleware/errorHandler';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024 }, // Fits the hosted request limit, including registration encoding.
  fileFilter: (_req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/jpg'].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(Object.assign(new Error('Only JPG and PNG images are allowed'), { statusCode: 400 }));
    }
  },
});

const router = express.Router();

// Public routes
router.post('/register', register);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Protected routes
router.get('/me', protect, getCurrentUser);
router.post('/logout',protect,asyncHandler(async(req,res)=>{
  const {error}=await supabase.rpc('revoke_account_sessions',{p_user:req.user!._id});
  if(error)throw new Error('Session revocation failed');
  res.json({success:true});
}));
router.put('/profile', protect, updateProfile);
router.post('/upload-profile-picture', protect, upload.single('profilePicture'), uploadProfilePicture);

export default router;

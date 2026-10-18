import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { profilePictureService } from '../services/profilePictureService';

export const uploadProfilePicture = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!._id.toString();
  const file = req.file;

  if (!file) {
    res.status(400).json({ success: false, error: { message: 'No image file provided' } });
    return;
  }

  try {
    profilePictureService.validateFile(file);
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
    return;
  }

  const key = await profilePictureService.uploadProfilePicture(userId, file);
  await profilePictureService.saveProfilePictureUrl(userId, key);
  const url=await profilePictureService.signedProfilePictureUrl(key,userId);

  res.status(200).json({
    success: true,
    data: { profilePictureUrl: url },
  });
});

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

  const url = await profilePictureService.uploadProfilePicture(userId, file);
  await profilePictureService.saveProfilePictureUrl(userId, url);

  res.status(200).json({
    success: true,
    data: { profilePictureUrl: url },
  });
});

export const uploadRegistrationPicture = asyncHandler(async (req: Request, res: Response) => {
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

  // Return Base64 for temporary preview/storage before user ID is known
  const base64 = file.buffer.toString('base64');
  const dataUrl = `data:${file.mimetype};base64,${base64}`;

  res.status(200).json({
    success: true,
    data: { tempImage: dataUrl, mimeType: file.mimetype },
  });
});

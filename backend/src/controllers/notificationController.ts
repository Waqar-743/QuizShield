import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { asyncHandler } from '../middleware/errorHandler';

export const getNotifications = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!._id.toString();

  const { data: notifications, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) throw new Error(error.message);

  res.status(200).json({
    success: true,
    data: notifications || [],
  });
});

export const markAsRead = asyncHandler(async (req: Request, res: Response) => {
  const { notificationId } = req.params;
  const userId = req.user!._id.toString();

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId)
    .eq('user_id', userId);

  if (error) throw new Error(error.message);

  res.status(200).json({
    success: true,
    message: 'Notification marked as read',
  });
});

export const markAllAsRead = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!._id.toString();

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) throw new Error(error.message);

  res.status(200).json({
    success: true,
    message: 'All notifications marked as read',
  });
});

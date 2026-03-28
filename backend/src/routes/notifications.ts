import express from 'express';
import { getNotifications, markAsRead, markAllAsRead } from '../controllers/notificationController';
import { protect } from '../middleware/auth';

const router = express.Router();

router.use(protect);

router.get('/', getNotifications);
router.put('/:notificationId/read', markAsRead);
router.put('/mark-all-read', markAllAsRead);

export default router;

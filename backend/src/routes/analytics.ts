import express from 'express';
import { 
  getDashboardStats, getCourseAnalytics, getWeakTopics, getProgressOverTime,
  getTeacherStats, getTeacherCoursePerformance, getTeacherCourseAnalytics,
  getTeacherTimeSeries, getTeacherCourses, getTeacherTopics, getTeacherQuestions
} from '../controllers/analyticsController';
import { protect, authorize } from '../middleware/auth';

const router = express.Router();

router.use(protect);

// Student analytics routes
router.get('/dashboard', getDashboardStats);
router.get('/performance/:courseId', getCourseAnalytics);
router.get('/weak-topics', getWeakTopics);
router.get('/progress-over-time', getProgressOverTime);

// Teacher analytics routes (teacher and admin only)
router.get('/teacher/stats', authorize('teacher', 'admin'), getTeacherStats);
router.get('/teacher/overview', authorize('teacher', 'admin'), getTeacherStats); // Alias for frontend compatibility
router.get('/teacher/course-performance', authorize('teacher', 'admin'), getTeacherCoursePerformance);
router.get('/teacher/course-analytics', authorize('teacher', 'admin'), getTeacherCourseAnalytics);
router.get('/teacher/time-series', authorize('teacher', 'admin'), getTeacherTimeSeries);
router.get('/teacher/courses', authorize('teacher', 'admin'), getTeacherCourses);
router.get('/teacher/topics', authorize('teacher', 'admin'), getTeacherTopics);
router.get('/teacher/questions', authorize('teacher', 'admin'), getTeacherQuestions);

export default router;

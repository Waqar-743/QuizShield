import express from 'express';
import { 
  getCourses, getCourseById, enrollInCourse, getEnrolledCourses,
  createCourse, updateCourse, deleteCourse,
  getTopicsByCourse, createTopic, updateTopic, deleteTopic,
  getQuestionsByTopic, createQuestion, updateQuestion, deleteQuestion,
  getTeacherCourses, getTeacherTopics, getTeacherQuestions
} from '../controllers/courseController';
import { protect, authorize } from '../middleware/auth';

const router = express.Router();

// Public/Student routes
router.get('/', getCourses);

// Protected routes
router.use(protect);

// Student enrollment routes
router.get('/my/enrolled', getEnrolledCourses);

// ============ Teacher routes (must come before /:id to avoid conflicts) ============
router.get('/teacher/my-courses', authorize('teacher', 'admin'), getTeacherCourses);
router.get('/teacher/topics', authorize('teacher', 'admin'), getTeacherTopics);
router.get('/teacher/questions', authorize('teacher', 'admin'), getTeacherQuestions);

// Course CRUD (teacher and admin only)
router.post('/', authorize('teacher', 'admin'), createCourse);
router.put('/:id', authorize('teacher', 'admin'), updateCourse);
router.delete('/:id', authorize('teacher', 'admin'), deleteCourse);

// Topics
router.get('/:courseId/topics', getTopicsByCourse);
router.post('/topics', authorize('teacher', 'admin'), createTopic);
router.put('/topics/:id', authorize('teacher', 'admin'), updateTopic);
router.delete('/topics/:id', authorize('teacher', 'admin'), deleteTopic);

// Questions
router.get('/topics/:topicId/questions', getQuestionsByTopic);
router.post('/questions', authorize('teacher', 'admin'), createQuestion);
router.put('/questions/:id', authorize('teacher', 'admin'), updateQuestion);
router.delete('/questions/:id', authorize('teacher', 'admin'), deleteQuestion);

// Get single course (must be last to avoid conflicts with /teacher/* routes)
router.get('/:id', getCourseById);
router.post('/:id/enroll', enrollInCourse);

export default router;

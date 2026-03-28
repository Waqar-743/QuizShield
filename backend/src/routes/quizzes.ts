import express from 'express';
import { 
  getQuizForTopic, submitAnswer, getHint, getQuizHistory,
  createQuiz, getTeacherQuizzes, updateQuiz, deleteQuiz, startQuizByCode, submitAllAnswers,
  getAttemptResults, getTeacherSubmissions, getTeacherQuizDetails, gradeSubmission,
  getTeacherAnalytics, getStudentAnalytics
} from '../controllers/quizController';
import {
  generateQuizCode, accessQuizByCode, getQuizCodes, toggleQuizCode, deleteQuizCode
} from '../controllers/quizCodeController';
import {
  reportViolation, getViolations, getViolationSummary, flagAttempt, invalidateAttempt
} from '../controllers/cheatingViolationController';
import { protect } from '../middleware/auth';

const router = express.Router();

router.use(protect);

// Get quiz history for user
router.get('/history', getQuizHistory);

// Teacher quiz management routes
router.get('/teacher/my-quizzes', getTeacherQuizzes);
router.get('/teacher/submissions', getTeacherSubmissions);
router.get('/teacher/quiz/:quizId', getTeacherQuizDetails);
router.get('/teacher/analytics', getTeacherAnalytics);

// Student analytics
router.get('/student/analytics', getStudentAnalytics);
router.put('/submissions/:submissionId/grade', gradeSubmission);

// Adaptive quiz routes for students
router.post('/generate', getQuizForTopic);
router.post('/:quizId/attempt', (req, res) => res.status(200).json({ success: true, message: 'Attempt already started by generate' })); // Mocked because getQuizForTopic does both
router.get('/:quizId/next-question', (req, res) => res.status(200).json({ success: true, data: null })); // Mocked

router.post('/', createQuiz);
router.put('/:quizId', updateQuiz);
router.delete('/:quizId', deleteQuiz);

// Quiz Code routes
router.get('/access-by-code/:code', accessQuizByCode);
router.post('/start-by-code/:code', startQuizByCode);
router.post('/:attemptId/submit-all', submitAllAnswers);
router.post('/:quizId/generate-code', generateQuizCode);
router.get('/:quizId/codes', getQuizCodes);
router.put('/codes/:code/toggle', toggleQuizCode);
router.delete('/codes/:code', deleteQuizCode);

// Anti-cheating routes
router.post('/attempts/:attemptId/report-violation', reportViolation);
router.get('/attempts/:attemptId/violations', getViolations);
router.get('/violations/summary', getViolationSummary);
router.post('/attempts/:attemptId/flag', flagAttempt);
router.post('/attempts/:attemptId/invalidate', invalidateAttempt);

// Get quiz for a topic (starts a session essentially)
router.get('/topic/:topicId', getQuizForTopic);

// Submit single answer
router.post('/:attemptId/question/:questionId/submit', submitAnswer);

// Get hint
router.get('/question/:questionId/hint', getHint);

// Get specific attempt results
router.get('/attempt/:attemptId/results', getAttemptResults);

export default router;

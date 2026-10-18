import express from 'express';
import { 
  generateQuestions, getHint, explainConcept, getRecommendations, getInsights, chatAssistant 
} from '../controllers/aiController';
import { protect, authorize } from '../middleware/auth';

const router = express.Router();

router.use(protect);

router.post('/generate-questions', authorize('teacher','admin'), generateQuestions);
router.post('/hint', getHint);
router.post('/explain', explainConcept);
router.get('/recommendations', getRecommendations);
router.get('/insights', getInsights);
router.post('/assistant', chatAssistant);

export default router;

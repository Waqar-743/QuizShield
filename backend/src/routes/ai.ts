import express from 'express';
import { 
  generateQuestions, getHint, explainConcept, getRecommendations, getInsights 
} from '../controllers/aiController';
import { protect } from '../middleware/auth';

const router = express.Router();

router.use(protect);

router.post('/generate-questions', generateQuestions);
router.post('/hint', getHint);
router.post('/explain', explainConcept);
router.get('/recommendations', getRecommendations);
router.get('/insights', getInsights);

export default router;

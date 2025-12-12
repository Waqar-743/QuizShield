import express from 'express';
import {
  createQuestion,
  getQuestionsByTopic,
  getQuestionById,
  updateQuestion,
  deleteQuestion
} from '../controllers/questionController';
import { protect } from '../middleware/auth';

const router = express.Router();

router.use(protect);

// Create a new question
router.post('/', createQuestion);

// Get questions by topic
router.get('/topic/:topicId', getQuestionsByTopic);

// Get single question
router.get('/:id', getQuestionById);

// Update a question
router.put('/:id', updateQuestion);

// Delete a question
router.delete('/:id', deleteQuestion);

export default router;

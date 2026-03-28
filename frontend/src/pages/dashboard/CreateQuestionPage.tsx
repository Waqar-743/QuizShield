import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiPlus, FiCheck, FiArrowLeft } from 'react-icons/fi';
import api from '../../services/api';
import toast from 'react-hot-toast';

type QuestionType = 'multipleChoice' | 'shortAnswer';
type Difficulty = 'Easy' | 'Medium' | 'Hard';

const CreateQuestionPage = () => {
  const { topicId } = useParams();
  const navigate = useNavigate();
  
  const [questionType, setQuestionType] = useState<QuestionType>('multipleChoice');
  const [questionText, setQuestionText] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('Medium');
  const [explanation, setExplanation] = useState('');
  const [loading, setLoading] = useState(false);

  // MCQ specific
  const [options, setOptions] = useState(['', '', '', '']);
  const [correctAnswerIndex, setCorrectAnswerIndex] = useState<number>(0);

  // Short answer specific
  const [acceptableAnswers, setAcceptableAnswers] = useState('');

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!questionText.trim()) {
      toast.error('Please enter a question');
      return;
    }

    if (questionType === 'multipleChoice') {
      const filledOptions = options.filter(o => o.trim());
      if (filledOptions.length < 4) {
        toast.error('Please fill all 4 options');
        return;
      }
    }

    if (questionType === 'shortAnswer' && !acceptableAnswers.trim()) {
      toast.error('Please enter at least one acceptable answer');
      return;
    }

    setLoading(true);

    try {
      const payload: any = {
        topicId,
        questionText,
        questionType,
        difficulty,
        explanation
      };

      if (questionType === 'multipleChoice') {
        payload.options = options;
        payload.correctAnswer = options[correctAnswerIndex];
      } else {
        payload.correctAnswers = acceptableAnswers.split(',').map(a => a.trim()).filter(Boolean);
      }

      await api.post('/questions', payload);
      toast.success('Question created successfully!');
      
      // Reset form
      setQuestionText('');
      setOptions(['', '', '', '']);
      setCorrectAnswerIndex(0);
      setAcceptableAnswers('');
      setExplanation('');
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Failed to create question');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center text-gray-600 hover:text-gray-900 mb-6"
      >
        <FiArrowLeft className="mr-2" />
        Back
      </button>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">Create New Question</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Question Type Selection */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Step 1: Question Type</h2>
          <div className="flex space-x-4">
            <label className="flex items-center">
              <input
                type="radio"
                name="questionType"
                value="multipleChoice"
                checked={questionType === 'multipleChoice'}
                onChange={() => setQuestionType('multipleChoice')}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500"
              />
              <span className="ml-2 text-sm text-gray-700">Multiple Choice (MCQ)</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="questionType"
                value="shortAnswer"
                checked={questionType === 'shortAnswer'}
                onChange={() => setQuestionType('shortAnswer')}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500"
              />
              <span className="ml-2 text-sm text-gray-700">Short Answer</span>
            </label>
          </div>
        </div>

        {/* Question Details */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Step 2: Question Details</h2>
          
          {/* Question Text */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Question Text
            </label>
            <textarea
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
              placeholder="Enter your question here..."
            />
          </div>

          {/* Difficulty */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Difficulty Level
            </label>
            <div className="flex space-x-4">
              {(['Easy', 'Medium', 'Hard'] as Difficulty[]).map((level) => (
                <label key={level} className="flex items-center">
                  <input
                    type="radio"
                    name="difficulty"
                    value={level}
                    checked={difficulty === level}
                    onChange={() => setDifficulty(level)}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">{level}</span>
                </label>
              ))}
            </div>
          </div>

          {/* MCQ Options */}
          {questionType === 'multipleChoice' && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Answer Options
              </label>
              <div className="space-y-3">
                {options.map((option, index) => (
                  <div key={index} className="flex items-center space-x-3">
                    <input
                      type="radio"
                      name="correctAnswer"
                      checked={correctAnswerIndex === index}
                      onChange={() => setCorrectAnswerIndex(index)}
                      className="h-4 w-4 text-green-600 focus:ring-green-500"
                      title="Mark as correct answer"
                    />
                    <input
                      type="text"
                      value={option}
                      onChange={(e) => handleOptionChange(index, e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                      placeholder={`Option ${String.fromCharCode(65 + index)}`}
                    />
                    {correctAnswerIndex === index && (
                      <span className="text-green-600 text-sm flex items-center">
                        <FiCheck className="mr-1" /> Correct
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-sm text-gray-500 mt-2">
                Select the radio button next to the correct answer
              </p>
            </div>
          )}

          {/* Short Answer Options */}
          {questionType === 'shortAnswer' && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Acceptable Answers (comma-separated)
              </label>
              <textarea
                value={acceptableAnswers}
                onChange={(e) => setAcceptableAnswers(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                placeholder="e.g., photosynthesis, cellular respiration, ATP"
              />
              <p className="text-sm text-gray-500 mt-1">
                Enter multiple acceptable answers separated by commas
              </p>
            </div>
          )}

          {/* Explanation */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Explanation (Optional)
            </label>
            <textarea
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
              placeholder="Explain why this is the correct answer..."
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 flex items-center"
          >
            {loading ? (
              <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />
            ) : (
              <FiPlus className="mr-2" />
            )}
            Save Question
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateQuestionPage;

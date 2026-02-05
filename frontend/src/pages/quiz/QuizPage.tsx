import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuiz } from '../../hooks/useQuiz';
import { useQuizSecurity } from '../../hooks/useQuizSecurity';
import { LightBulbIcon, ClockIcon } from '@heroicons/react/24/outline';

const QuizPage: React.FC = () => {
  const { quizId, attemptId } = useParams<{ quizId: string; attemptId: string }>();
  const navigate = useNavigate();
  const { 
    currentQuestion, 
    loading, 
    error, 
    submitAnswer, 
    getHint 
  } = useQuiz();

  // Security hook
  useQuizSecurity({
    quizAttemptId: attemptId || '',
    quizId: quizId || '',
  });

  const [selectedAnswer, setSelectedAnswer] = useState<string>('');
  const [hint, setHint] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(60); // Default 60s if not specified

  // Handle Question Timer
  useEffect(() => {
    if (currentQuestion) {
      // Set time to question's limit or default 60s
      setTimeLeft(currentQuestion.timeLimit || 60);
    }
  }, [currentQuestion]);

  const handleSubmit = useCallback(async () => {
    if (!quizId || !attemptId || !currentQuestion) return;
    
    // Use currently selected answer, or empty string if time is up
    await submitAnswer(quizId, attemptId, currentQuestion._id, selectedAnswer);
    setSelectedAnswer('');
    setHint(null);
    setShowHint(false);
  }, [quizId, attemptId, currentQuestion, selectedAnswer, submitAnswer]);

  useEffect(() => {
    if (timeLeft <= 0) {
      handleSubmit();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, handleSubmit]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // If we don't have a current question but have IDs, we might need to re-fetch or handle state
  // Ideally, the hook or a parent component manages the flow. 
  // For simplicity, we assume the user lands here after 'startQuiz' or is redirected.
  // If currentQuestion is null, we might need to fetch the 'next' question again or check status.
  // However, useQuiz is designed to hold state. If page refresh happens, state is lost.
  // A more robust app would fetch current state on mount.
  
  // For this demo, if no question is present, we redirect to dashboard or show error
  useEffect(() => {
    if (!currentQuestion && !loading && !error) {
       // In a real app, we'd try to recover the session here
       // navigate('/dashboard');
    }
  }, [currentQuestion, loading, error, navigate]);

  const handleOptionSelect = (option: string) => {
    setSelectedAnswer(option);
  };

  const handleSubmit = async () => {
    if (!selectedAnswer || !quizId || !attemptId || !currentQuestion) return;
    
    await submitAnswer(quizId, attemptId, currentQuestion._id, selectedAnswer);
    setSelectedAnswer('');
    setHint(null);
    setShowHint(false);
  };

  const handleRequestHint = async () => {
    if (!currentQuestion) return;
    const hintText = await getHint(currentQuestion._id);
    setHint(hintText);
    setShowHint(true);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full text-center">
          <h2 className="text-red-600 text-xl font-bold mb-4">Error</h2>
          <p className="text-gray-700 mb-6">{error}</p>
          <button 
            onClick={() => navigate('/dashboard')}
            className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-100">
        <div className="text-center">
          <p className="text-gray-500">Loading question...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        {/* Progress / Header */}
        <div className="mb-8 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">Quiz Session</h2>
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-mono font-bold ${
              timeLeft < 10 ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-indigo-100 text-indigo-700'
            }`}>
              <ClockIcon className="h-4 w-4" />
              {formatTime(timeLeft)}
            </div>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-indigo-100 text-indigo-800">
              {currentQuestion.difficulty}
            </span>
          </div>
        </div>

        {/* Question Card */}
        <div className="bg-white shadow sm:rounded-lg overflow-hidden">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              {currentQuestion.content}
            </h3>

            <div className="space-y-4 mt-6">
              {currentQuestion.options.map((option, idx) => (
                <div 
                  key={idx}
                  onClick={() => handleOptionSelect(option)}
                  className={`relative border rounded-lg p-4 cursor-pointer flex items-center transition-colors
                    ${selectedAnswer === option 
                      ? 'border-indigo-500 ring-2 ring-indigo-500 bg-indigo-50' 
                      : 'border-gray-300 hover:border-indigo-400 hover:bg-gray-50'
                    }`}
                >
                  <div className={`h-4 w-4 rounded-full border flex items-center justify-center mr-3
                    ${selectedAnswer === option ? 'border-indigo-600' : 'border-gray-400'}`}>
                    {selectedAnswer === option && (
                      <div className="h-2 w-2 rounded-full bg-indigo-600" />
                    )}
                  </div>
                  <span className="text-gray-900">{option}</span>
                </div>
              ))}
            </div>
          </div>
          
          <div className="bg-gray-50 px-4 py-4 sm:px-6 flex justify-between items-center">
            <button
              type="button"
              onClick={handleRequestHint}
              className="inline-flex items-center text-sm text-gray-500 hover:text-indigo-600"
            >
              <LightBulbIcon className="h-5 w-5 mr-1" />
              Need a hint?
            </button>
            
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!selectedAnswer || loading}
              className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white 
                ${!selectedAnswer || loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'}`}
            >
              {loading ? 'Submitting...' : 'Submit Answer'}
            </button>
          </div>
          
          {showHint && hint && (
            <div className="bg-yellow-50 px-4 py-3 border-t border-yellow-100">
              <div className="flex">
                <div className="flex-shrink-0">
                  <LightBulbIcon className="h-5 w-5 text-yellow-400" aria-hidden="true" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-yellow-800">Hint</h3>
                  <div className="mt-2 text-sm text-yellow-700">
                    <p>{hint}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuizPage;

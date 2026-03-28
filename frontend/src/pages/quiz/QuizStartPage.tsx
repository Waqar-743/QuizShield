import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuiz } from '../../hooks/useQuiz';
import { PlayIcon } from '@heroicons/react/24/solid';

const QuizStartPage: React.FC = () => {
  const { topicId } = useParams<{ topicId: string }>();
  const navigate = useNavigate();
  const { startQuiz, loading, error } = useQuiz();

  const handleStart = () => {
    if (topicId) {
      startQuiz(topicId);
    }
  };

  useEffect(() => {
    if (!topicId) {
      navigate('/courses');
    }
  }, [topicId, navigate]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-indigo-100 mb-4">
            <PlayIcon className="h-6 w-6 text-indigo-600" aria-hidden="true" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Ready to Start?</h2>
          <p className="text-gray-500 mb-6">
            You are about to start a quiz for this topic. The questions will adapt to your performance.
          </p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
              <span className="block sm:inline">{error}</span>
            </div>
          )}

          <button
            onClick={handleStart}
            disabled={loading}
            className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white 
              ${loading ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'}`}
          >
            {loading ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Generating Quiz...
              </>
            ) : (
              'Start Quiz'
            )}
          </button>
          
          <button
            onClick={() => navigate(-1)}
            className="mt-4 w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuizStartPage;

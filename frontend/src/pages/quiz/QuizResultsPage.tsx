import React, { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuiz } from '../../hooks/useQuiz';
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/solid';

const QuizResultsPage: React.FC = () => {
  const { attemptId } = useParams<{ attemptId: string }>();
  const { currentAttempt, loading, error, getAttemptResults } = useQuiz();

  useEffect(() => {
    if (attemptId) {
      getAttemptResults(attemptId);
    }
  }, [attemptId, getAttemptResults]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (error || !currentAttempt) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-100">
        <div className="text-center">
          <p className="text-red-500">{error || 'Results not found'}</p>
          <Link to="/dashboard" className="text-indigo-600 hover:text-indigo-500 mt-4 inline-block">
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const percentage = Math.round((currentAttempt.score / currentAttempt.maxScore) * 100) || 0;

  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:px-6 text-center">
            <h2 className="text-3xl font-bold text-gray-900">Quiz Completed!</h2>
            <p className="mt-1 max-w-2xl text-sm text-gray-500 mx-auto">
              Here is how you performed.
            </p>
          </div>
          
          <div className="border-t border-gray-200 px-4 py-5 sm:p-6 text-center">
            <div className="inline-flex items-center justify-center h-32 w-32 rounded-full bg-indigo-100 mb-6">
              <span className="text-4xl font-bold text-indigo-600">{percentage}%</span>
            </div>
            
            <dl className="grid grid-cols-1 gap-5 sm:grid-cols-3 mb-8">
              <div className="px-4 py-5 bg-gray-50 shadow rounded-lg overflow-hidden sm:p-6">
                <dt className="text-sm font-medium text-gray-500 truncate">Score</dt>
                <dd className="mt-1 text-3xl font-semibold text-gray-900">{currentAttempt.score} / {currentAttempt.maxScore}</dd>
              </div>
              <div className="px-4 py-5 bg-gray-50 shadow rounded-lg overflow-hidden sm:p-6">
                <dt className="text-sm font-medium text-gray-500 truncate">Questions</dt>
                <dd className="mt-1 text-3xl font-semibold text-gray-900">{currentAttempt.answers.length}</dd>
              </div>
              <div className="px-4 py-5 bg-gray-50 shadow rounded-lg overflow-hidden sm:p-6">
                <dt className="text-sm font-medium text-gray-500 truncate">Status</dt>
                <dd className="mt-1 text-3xl font-semibold text-gray-900 capitalize">
                  {currentAttempt.isCompleted ? 'Completed' : 'In Progress'}
                </dd>
              </div>
            </dl>

            <h3 className="text-lg font-medium text-gray-900 mb-4 text-left">Question Review</h3>
            <ul className="divide-y divide-gray-200 text-left">
              {currentAttempt.answers.map((ans: any, idx: number) => (
                <li key={idx} className="py-4">
                  <div className="flex items-start">
                    <div className="flex-shrink-0 mr-3">
                      {ans.isCorrect ? (
                        <CheckCircleIcon className="h-6 w-6 text-green-500" />
                      ) : (
                        <XCircleIcon className="h-6 w-6 text-red-500" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Question {idx + 1}</p>
                      <p className="text-sm text-gray-500">
                        Your answer: <span className={ans.isCorrect ? 'text-green-600' : 'text-red-600'}>{ans.selectedAnswer}</span>
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          
          <div className="bg-gray-50 px-4 py-4 sm:px-6 flex justify-center space-x-4">
            <Link
              to="/dashboard"
              className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Back to Dashboard
            </Link>
            <Link
              to="/courses"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Take Another Quiz
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuizResultsPage;

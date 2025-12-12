import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiKey, FiArrowRight, FiAlertCircle } from 'react-icons/fi';
import api from '../../services/api';
import toast from 'react-hot-toast';

const AccessByCodePage = () => {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quizDetails, setQuizDetails] = useState<any>(null);

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    setCode(value);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (code.length !== 8) {
      setError('Please enter a valid 8-character code');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await api.get(`/quizzes/access-by-code/${code}`);
      setQuizDetails(response.data.data);
      toast.success('Quiz found!');
    } catch (err: any) {
      const message = err.response?.data?.error?.message || 'Invalid or expired code';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleStartQuiz = () => {
    if (quizDetails?.quiz?.topic_id) {
      navigate(`/quiz/topic/${quizDetails.quiz.topic_id}?code=${code}`);
    }
  };

  const handleTryAnother = () => {
    setCode('');
    setQuizDetails(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="h-16 w-16 bg-primary-100 rounded-full flex items-center justify-center">
            <FiKey className="h-8 w-8 text-primary-600" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Access Quiz via Code
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Enter the 8-character code provided by your teacher
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {!quizDetails ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="code" className="block text-sm font-medium text-gray-700">
                  Quiz Code
                </label>
                <div className="mt-1">
                  <input
                    id="code"
                    name="code"
                    type="text"
                    value={code}
                    onChange={handleCodeChange}
                    placeholder="ABCD1234"
                    className="appearance-none block w-full px-3 py-3 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-center text-2xl tracking-widest font-mono uppercase"
                    maxLength={8}
                  />
                </div>
                <p className="mt-2 text-sm text-gray-500 text-center">
                  {code.length}/8 characters
                </p>
              </div>

              {error && (
                <div className="rounded-md bg-red-50 p-4">
                  <div className="flex">
                    <FiAlertCircle className="h-5 w-5 text-red-400" />
                    <div className="ml-3">
                      <p className="text-sm text-red-700">{error}</p>
                    </div>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || code.length !== 8}
                className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                ) : (
                  <>
                    Access Quiz
                    <FiArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          ) : (
            <div className="space-y-6">
              <div className="bg-green-50 rounded-lg p-4">
                <h3 className="text-lg font-medium text-green-800">Quiz Found!</h3>
                <div className="mt-4 space-y-2">
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Quiz:</span> {quizDetails.quiz?.title || 'Untitled Quiz'}
                  </p>
                  {quizDetails.course && (
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Course:</span> {quizDetails.course.title}
                    </p>
                  )}
                  {quizDetails.quiz?.time_limit && (
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Time Limit:</span> {quizDetails.quiz.time_limit} minutes
                    </p>
                  )}
                  {quizDetails.quiz?.description && (
                    <p className="text-sm text-gray-600 mt-2">
                      {quizDetails.quiz.description}
                    </p>
                  )}
                </div>
              </div>

              <div className="bg-yellow-50 rounded-lg p-4">
                <p className="text-sm text-yellow-700">
                  <strong>Important:</strong> Once you start the quiz, do not switch tabs or windows. 
                  Any suspicious activity will be recorded.
                </p>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={handleTryAnother}
                  className="flex-1 py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  Try Another Code
                </button>
                <button
                  onClick={handleStartQuiz}
                  className="flex-1 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  Start Quiz
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AccessByCodePage;

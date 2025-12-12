import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../../services/api';
import toast from 'react-hot-toast';
import {
  KeyIcon,
  ArrowRightIcon,
  ExclamationCircleIcon,
  ClockIcon,
  DocumentTextIcon,
  CalendarIcon,
} from '@heroicons/react/24/outline';

const JoinQuizPage = () => {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quizDetails, setQuizDetails] = useState<any>(null);
  const [timeUntilStart, setTimeUntilStart] = useState<string | null>(null);
  const [canStart, setCanStart] = useState(true);
  const [isExpired, setIsExpired] = useState(false);

  // Check if quiz can be started based on scheduled time and expiration
  useEffect(() => {
    if (quizDetails?.quiz) {
      // Check if already marked as expired
      if (quizDetails.quiz.isExpired) {
        setIsExpired(true);
        setCanStart(false);
        return;
      }

      const checkTime = () => {
        const now = new Date();
        
        // Check expiration time
        if (quizDetails.quiz.expiresAt) {
          const expiryTime = new Date(quizDetails.quiz.expiresAt);
          if (now > expiryTime) {
            setIsExpired(true);
            setCanStart(false);
            setTimeUntilStart(null);
            return;
          }
        }

        // Check scheduled start time
        if (quizDetails.quiz.scheduledStart) {
          const scheduledTime = new Date(quizDetails.quiz.scheduledStart);
          const diff = scheduledTime.getTime() - now.getTime();
          
          if (diff <= 0) {
            setCanStart(true);
            setTimeUntilStart(null);
          } else {
            setCanStart(false);
            const minutes = Math.floor(diff / 60000);
            const seconds = Math.floor((diff % 60000) / 1000);
            if (minutes > 60) {
              const hours = Math.floor(minutes / 60);
              setTimeUntilStart(`${hours}h ${minutes % 60}m`);
            } else {
              setTimeUntilStart(`${minutes}m ${seconds}s`);
            }
          }
        } else {
          setCanStart(true);
          setTimeUntilStart(null);
        }
      };
      
      checkTime();
      const interval = setInterval(checkTime, 1000);
      return () => clearInterval(interval);
    } else {
      setCanStart(true);
      setTimeUntilStart(null);
      setIsExpired(false);
    }
  }, [quizDetails]);

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, '').slice(0, 4);
    setCode(value);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (code.length !== 4) {
      setError('Please enter a valid 4-digit code');
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

  const handleStartQuiz = async () => {
    if (isExpired) {
      toast.error('This quiz has expired and is no longer accessible.');
      return;
    }
    
    if (!canStart) {
      toast.error('Quiz has not started yet. Please wait.');
      return;
    }

    setStarting(true);
    try {
      const response = await api.post(`/quizzes/start-by-code/${code}`);
      const { attemptId, quiz } = response.data.data;
      
      // Store quiz data in sessionStorage for the quiz page
      sessionStorage.setItem('currentQuiz', JSON.stringify({
        attemptId,
        quiz,
        code
      }));
      
      navigate(`/quiz/take/${attemptId}`);
    } catch (err: any) {
      const message = err.response?.data?.error?.message || 'Failed to start quiz';
      
      // Check if quiz has expired
      if (message === 'QUIZ_EXPIRED' || message.toLowerCase().includes('expired')) {
        setIsExpired(true);
        setCanStart(false);
        toast.error('This quiz has expired and is no longer accessible.');
      } else {
        toast.error(message);
      }
      setError(message);
    } finally {
      setStarting(false);
    }
  };

  const handleTryAnother = () => {
    setCode('');
    setQuizDetails(null);
    setError(null);
    setIsExpired(false);
    setCanStart(true);
    setTimeUntilStart(null);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Join Quiz</h1>
        <p className="text-sm text-gray-500 mt-1">
          Enter the quiz code provided by your teacher to start a quiz
        </p>
      </header>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        {!quizDetails ? (
          <>
            <div className="flex justify-center mb-6">
              <div className="h-16 w-16 bg-indigo-100 rounded-full flex items-center justify-center">
                <KeyIcon className="h-8 w-8 text-indigo-600" />
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-2 text-center">
                  Enter Quiz Code
                </label>
                <input
                  id="code"
                  name="code"
                  type="text"
                  inputMode="numeric"
                  value={code}
                  onChange={handleCodeChange}
                  placeholder="1234"
                  className="w-full px-4 py-4 border border-gray-300 rounded-xl text-center text-4xl tracking-[0.5em] font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  maxLength={4}
                  autoComplete="off"
                />
                <p className="mt-2 text-sm text-gray-500 text-center">
                  {code.length}/4 digits
                </p>
              </div>

              {error && (
                <div className="rounded-lg bg-red-50 p-4 flex items-start gap-3">
                  <ExclamationCircleIcon className="h-5 w-5 text-red-400 mt-0.5" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || code.length !== 4}
                className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-xl text-base font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? (
                  <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                ) : (
                  <>
                    Access Quiz
                    <ArrowRightIcon className="ml-2 h-5 w-5" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-8 pt-6 border-t border-gray-200">
              <h4 className="text-sm font-medium text-gray-700 mb-3">How it works:</h4>
              <ul className="space-y-2 text-sm text-gray-500">
                <li className="flex items-start gap-2">
                  <span className="inline-flex items-center justify-center h-5 w-5 bg-indigo-100 text-indigo-600 rounded-full text-xs font-medium">1</span>
                  Get the 4-digit code from your teacher
                </li>
                <li className="flex items-start gap-2">
                  <span className="inline-flex items-center justify-center h-5 w-5 bg-indigo-100 text-indigo-600 rounded-full text-xs font-medium">2</span>
                  Enter the code above and click "Access Quiz"
                </li>
                <li className="flex items-start gap-2">
                  <span className="inline-flex items-center justify-center h-5 w-5 bg-indigo-100 text-indigo-600 rounded-full text-xs font-medium">3</span>
                  Review quiz details and start when ready
                </li>
              </ul>
            </div>
          </>
        ) : (
          <div className="space-y-6">
            <div className="text-center">
              <div className="inline-flex items-center justify-center h-16 w-16 bg-green-100 rounded-full mb-4">
                <DocumentTextIcon className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900">Quiz Found!</h3>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div>
                <p className="text-sm text-gray-500">Quiz Title</p>
                <p className="font-medium text-gray-900">{quizDetails.quiz?.title || 'Untitled Quiz'}</p>
              </div>
              {quizDetails.quiz?.description && (
                <div>
                  <p className="text-sm text-gray-500">Description</p>
                  <p className="text-gray-700">{quizDetails.quiz.description}</p>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-4">
                {quizDetails.quiz?.timeLimit && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <ClockIcon className="h-5 w-5" />
                    <span>{quizDetails.quiz.timeLimit} minutes</span>
                  </div>
                )}
                {quizDetails.quiz?.questionCount && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <DocumentTextIcon className="h-5 w-5" />
                    <span>{quizDetails.quiz.questionCount} questions</span>
                  </div>
                )}
              </div>
              {quizDetails.quiz?.scheduledStart && (
                <div className="flex items-center gap-2 text-indigo-600 font-medium">
                  <CalendarIcon className="h-5 w-5" />
                  <span>Scheduled: {new Date(quizDetails.quiz.scheduledStart).toLocaleString()}</span>
                </div>
              )}
            </div>

            {isExpired && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                <ExclamationCircleIcon className="h-12 w-12 text-red-500 mx-auto mb-2" />
                <p className="text-lg font-semibold text-red-700">Quiz Has Expired</p>
                <p className="text-sm text-red-600 mt-1">
                  This quiz is no longer accessible. The submission window has closed.
                </p>
                {quizDetails.quiz?.expiresAt && (
                  <p className="text-xs text-red-500 mt-2">
                    Expired at: {new Date(quizDetails.quiz.expiresAt).toLocaleString()}
                  </p>
                )}
              </div>
            )}

            {!isExpired && !canStart && timeUntilStart && (
              <div className="bg-indigo-50 rounded-lg p-4 text-center">
                <p className="text-sm text-indigo-700 mb-2">Quiz starts in:</p>
                <p className="text-3xl font-bold text-indigo-600">{timeUntilStart}</p>
              </div>
            )}

            <div className="bg-yellow-50 rounded-lg p-4">
              <p className="text-sm text-yellow-700">
                <strong>Important:</strong> Once you start the quiz, the timer will begin. 
                Do not switch tabs or windows during the quiz.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleTryAnother}
                disabled={starting}
                className="flex-1 py-3 px-4 border border-gray-300 rounded-xl text-base font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors disabled:opacity-50"
              >
                Try Another Code
              </button>
              <button
                onClick={handleStartQuiz}
                disabled={!canStart || starting || isExpired}
                className={`flex-1 py-3 px-4 border border-transparent rounded-xl text-base font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  isExpired 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
                }`}
              >
                {starting ? (
                  <span className="flex items-center justify-center">
                    <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full mr-2" />
                    Starting...
                  </span>
                ) : isExpired ? (
                  'Quiz Expired'
                ) : !canStart ? (
                  'Please Wait...'
                ) : (
                  'Start Quiz'
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default JoinQuizPage;

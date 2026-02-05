import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { ClockIcon, CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

interface Question {
  _id: string;
  text: string;
  options: string[];
  difficulty: string;
  timeLimit: number; // Added per-question time limit
}

interface QuizData {
  attemptId: string;
  quiz: {
    _id: string;
    title: string;
    description: string;
    timeLimit: number;
    questions: Question[];
  };
  code: string;
}

interface Violation {
  type: 'tab_switch' | 'copy_attempt' | 'paste_attempt' | 'right_click';
  timestamp: string;
  details?: string;
}

const QuizTakePage = () => {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();
  
  const [quizData, setQuizData] = useState<QuizData | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);
  
  // Anti-cheating state
  const [violations, setViolations] = useState<Violation[]>([]);
  const [showWarning, setShowWarning] = useState(false);
  const [warningMessage, setWarningMessage] = useState('');

  // Add a violation
  const addViolation = useCallback(async (type: Violation['type'], details?: string) => {
    const violation: Violation = {
      type,
      timestamp: new Date().toISOString(),
      details,
    };
    setViolations(prev => [...prev, violation]);
    
    // Show warning to user
    const messages: Record<string, string> = {
      'tab_switch': 'Warning: Tab switch recorded!',
      'copy_attempt': 'Warning: Copy attempt recorded!',
      'paste_attempt': 'Warning: Paste attempt recorded!',
      'right_click': 'Warning: Right-click recorded!',
    };
    setWarningMessage(messages[type] || 'Warning: Action recorded!');
    setShowWarning(true);
    setTimeout(() => setShowWarning(false), 2000);

    // Report to backend in real-time
    try {
      const response = await api.post(`/quizzes/attempts/${attemptId}/report-violation`, {
        violationType: type === 'tab_switch' ? 'tab_change' : type,
        detectionMethod: 'browser_event',
        details: details || 'Manual action detection',
        quizId: quizData?.quiz._id
      });

      if (response.data.data.autoSubmitted) {
        toast.error('Quiz auto-submitted due to excessive violations (Over 100).', {
          duration: 5000,
        });
        navigate(`/quiz/results/${attemptId}`);
      }
    } catch (error) {
      console.error('Failed to report violation:', error);
    }
  }, [attemptId, quizData, navigate]);

  // Prevent copy
  useEffect(() => {
    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      addViolation('copy_attempt');
    };

    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault();
      addViolation('paste_attempt');
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      addViolation('right_click');
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey && ['c', 'v', 'a', 'p', 'u'].includes(e.key.toLowerCase())) ||
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && ['i', 'j', 'c'].includes(e.key.toLowerCase()))
      ) {
        e.preventDefault();
        if (e.key.toLowerCase() === 'c') {
          addViolation('copy_attempt');
        } else if (e.key.toLowerCase() === 'v') {
          addViolation('paste_attempt');
        }
      }
    };

    document.addEventListener('copy', handleCopy);
    document.addEventListener('paste', handlePaste);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('paste', handlePaste);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [addViolation]);

  // Detect tab/window change
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        addViolation('tab_switch', 'User switched away from quiz tab');
      }
    };

    const handleBlur = () => {
      addViolation('tab_switch', 'Quiz window lost focus');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
    };
  }, [addViolation]);

  // Disable text selection
  useEffect(() => {
    document.body.style.userSelect = 'none';
    document.body.style.webkitUserSelect = 'none';
    
    return () => {
      document.body.style.userSelect = '';
      document.body.style.webkitUserSelect = '';
    };
  }, []);

  useEffect(() => {
    const storedData = sessionStorage.getItem('currentQuiz');
    if (storedData) {
      const data = JSON.parse(storedData) as QuizData;
      setQuizData(data);
      // Initialize with the first question's time limit
      if (data.quiz.questions.length > 0) {
        setTimeLeft(data.quiz.questions[0].timeLimit || 60);
      }
    } else {
      toast.error('Quiz data not found. Please try again.');
      navigate('/dashboard/student/join-quiz');
    }
  }, [navigate]);

  // Set timer whenever question changes
  useEffect(() => {
    if (quizData && quizData.quiz.questions[currentQuestionIndex]) {
      const qTime = (quizData.quiz.questions[currentQuestionIndex] as any).timeLimit || 60;
      setTimeLeft(qTime);
    }
  }, [currentQuestionIndex, quizData]);

  // Timer countdown
  useEffect(() => {
    if (timeLeft <= 0 || !quizData) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleAutoNext();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, quizData]);

  const handleAutoNext = () => {
    if (!quizData) return;
    
    // If it's the last question, submit the quiz
    if (currentQuestionIndex === quizData.quiz.questions.length - 1) {
      toast.error('Time is up for the last question! Submitting quiz...', { duration: 3000 });
      handleSubmitQuiz();
    } else {
      toast.error('Time is up for this question! Moving to the next one.', { duration: 2000 });
      // Mark current question as -1 (no answer) if not already answered
      if (selectedAnswers[currentQuestionIndex] === undefined) {
        setSelectedAnswers(prev => ({ ...prev, [currentQuestionIndex]: -1 }));
      }
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSelectAnswer = (questionIndex: number, optionIndex: number) => {
    setSelectedAnswers((prev) => ({
      ...prev,
      [questionIndex]: optionIndex,
    }));
  };

  const handleSubmitQuiz = async () => {
    if (!quizData) return;
    
    setSubmitting(true);
    try {
      const answers = quizData.quiz.questions.map((q, index) => ({
        questionId: q._id,
        selectedAnswer: selectedAnswers[index] ?? -1,
      }));

      await api.post(`/quizzes/${attemptId}/submit-all`, { 
        answers,
        violations: violations.length > 0 ? violations : undefined,
      });
      
      sessionStorage.removeItem('currentQuiz');
      toast.success('Quiz submitted successfully!');
      navigate(`/quiz/teacher-results/${attemptId}`);
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Failed to submit quiz');
    } finally {
      setSubmitting(false);
    }
  };

  if (!quizData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  const currentQuestion = quizData.quiz.questions[currentQuestionIndex];
  const totalQuestions = quizData.quiz.questions.length;
  const answeredCount = Object.keys(selectedAnswers).length;

  return (
    <div className="min-h-screen bg-gray-50 select-none">
      {/* Warning Banner */}
      {showWarning && (
        <div className="fixed top-0 left-0 right-0 bg-red-500 text-white py-3 px-4 z-50 flex items-center justify-center gap-2 animate-pulse">
          <ExclamationTriangleIcon className="h-5 w-5" />
          <span className="font-medium">{warningMessage}</span>
        </div>
      )}

      {/* Violations List - Fixed Bottom Right Corner */}
      <div className="fixed bottom-4 right-4 z-40 max-w-xs">
        {/* Violations Counter Badge */}
        <div className={`mb-2 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 ${
          violations.length === 0 
            ? 'bg-green-500 text-white'
            : violations.length < 10
            ? 'bg-yellow-500 text-white'
            : violations.length < 50
            ? 'bg-orange-500 text-white'
            : 'bg-red-500 text-white'
        }`}>
          <ExclamationTriangleIcon className="h-3.5 w-3.5" />
          <span>Violations: {violations.length}</span>
        </div>
        
        {/* Recent Violations List */}
        {violations.length > 0 && (
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {violations.slice(-8).reverse().map((v, i) => (
              <div 
                key={i} 
                className={`px-2 py-1 rounded text-xs flex items-center gap-1.5 ${
                  v.type === 'tab_switch' ? 'bg-orange-100 text-orange-700' :
                  v.type === 'copy_attempt' ? 'bg-red-100 text-red-700' :
                  v.type === 'paste_attempt' ? 'bg-purple-100 text-purple-700' :
                  'bg-gray-100 text-gray-700'
                }`}
              >
                <span className="font-medium">
                  {v.type === 'tab_switch' ? 'Tab' :
                   v.type === 'copy_attempt' ? 'Copy' :
                   v.type === 'paste_attempt' ? 'Paste' :
                   v.type === 'right_click' ? 'R-Click' : v.type}
                </span>
                <span className="text-[10px] opacity-70">
                  {new Date(v.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Header */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold text-gray-900">{quizData.quiz.title}</h1>
              <p className="text-sm text-gray-500">
                Question {currentQuestionIndex + 1} of {totalQuestions}
              </p>
            </div>
            <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
              timeLeft < 10 ? 'bg-red-100 text-red-700 animate-pulse' : 'bg-indigo-100 text-indigo-700'
            }`}>
              <ClockIcon className="h-5 w-5" />
              <span className="font-mono font-bold text-lg">{formatTime(timeLeft)}</span>
            </div>
          </div>
          
          {/* Progress bar */}
          <div className="mt-4 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-indigo-600 transition-all duration-300"
              style={{ width: `${((currentQuestionIndex + 1) / totalQuestions) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Question Card */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="mb-6">
            <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
              currentQuestion.difficulty === 'Easy' ? 'bg-green-100 text-green-700' :
              currentQuestion.difficulty === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
              'bg-red-100 text-red-700'
            }`}>
              {currentQuestion.difficulty}
            </span>
          </div>
          
          <h2 className="text-xl font-medium text-gray-900 mb-6">
            {currentQuestion.text}
          </h2>

          <div className="space-y-3">
            {currentQuestion.options.map((option, index) => (
              <button
                key={index}
                onClick={() => handleSelectAnswer(currentQuestionIndex, index)}
                className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                  selectedAnswers[currentQuestionIndex] === index
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    selectedAnswers[currentQuestionIndex] === index
                      ? 'bg-indigo-500 text-white'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {String.fromCharCode(65 + index)}
                  </span>
                  <span className="text-gray-900">{option}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Anti-cheating notice */}
        <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
          <ExclamationTriangleIcon className="h-4 w-4 inline mr-1" />
          This quiz is monitored. All violations are recorded and shared with your teacher.
        </div>

        {/* Navigation */}
        <div className="mt-6 flex items-center justify-between">
          <button
            onClick={() => setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))}
            disabled={currentQuestionIndex === 0}
            className="px-4 py-2 text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>

          <div className="flex items-center gap-2 flex-wrap justify-center">
            {quizData.quiz.questions.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentQuestionIndex(index)}
                className={`w-8 h-8 rounded-full text-sm font-medium transition-all ${
                  index === currentQuestionIndex
                    ? 'bg-indigo-600 text-white'
                    : selectedAnswers[index] !== undefined
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {index + 1}
              </button>
            ))}
          </div>

          {currentQuestionIndex === totalQuestions - 1 ? (
            <button
              onClick={handleSubmitQuiz}
              disabled={submitting}
              className="px-6 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                  Submitting...
                </>
              ) : (
                <>
                  <CheckCircleIcon className="h-5 w-5" />
                  Submit ({answeredCount}/{totalQuestions})
                </>
              )}
            </button>
          ) : (
            <button
              onClick={() => setCurrentQuestionIndex((prev) => Math.min(totalQuestions - 1, prev + 1))}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700"
            >
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuizTakePage;

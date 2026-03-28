import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { CheckCircleIcon, XCircleIcon, TrophyIcon, ArrowLeftIcon } from '@heroicons/react/24/solid';
import { ClockIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

interface Violation {
  type: string;
  timestamp: string;
  details?: string;
}

interface AttemptResult {
  id: string;
  score?: number;
  maxScore?: number;
  percentage?: number;
  status: string;
  startedAt: string;
  completedAt: string;
  answers: { questionId: string; selectedAnswer: number }[];
  violations: Violation[];
  reviewPending?: boolean;
  reviewStatus?: 'pending' | 'reviewed';
  quiz: {
    title: string;
    description: string;
    questions: {
      text: string;
      options: string[];
      correctAnswer: number;
      explanation?: string;
    }[];
  };
  teacherFeedback?: string;
  teacherGrade?: number;
}

const TeacherQuizResultsPage = () => {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchResults = async () => {
      try {
        const response = await api.get(`/quizzes/attempt/${attemptId}/results`);
        setResult(response.data.data);
      } catch (err: any) {
        setError(err.response?.data?.error?.message || 'Failed to load results');
      } finally {
        setLoading(false);
      }
    };

    if (attemptId) {
      fetchResults();
    }
  }, [attemptId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error || 'Results not found'}</p>
          <Link to="/dashboard/student" className="text-indigo-600 hover:text-indigo-500">
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const isPendingReview = result.reviewStatus === 'pending' || !!result.reviewPending;
  const percentage = result.percentage ?? 0;
  const isPassing = percentage >= 60;

  if (isPendingReview) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 py-8 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white rounded-xl shadow-sm border p-8 text-center">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-amber-100 mb-4">
              <ClockIcon className="h-8 w-8 text-amber-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Submission Received</h1>
            <p className="text-gray-600 mb-6">
              Your quiz has been submitted and sent to your teacher for review.
              Your grade will appear once the teacher publishes feedback.
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-left mb-6">
              <p className="text-sm text-amber-800">
                <span className="font-medium">Quiz:</span> {result.quiz?.title || 'Quiz'}
              </p>
              <p className="text-sm text-amber-800 mt-1">
                <span className="font-medium">Submitted at:</span>{' '}
                {result.completedAt ? new Date(result.completedAt).toLocaleString() : 'N/A'}
              </p>
            </div>
            <div className="flex justify-center gap-4">
              <button
                onClick={() => navigate('/dashboard/student')}
                className="inline-flex items-center gap-2 px-6 py-3 border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50"
              >
                <ArrowLeftIcon className="h-5 w-5" />
                Back to Dashboard
              </button>
              <Link
                to="/dashboard/student/quiz-history"
                className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                View Quiz History
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Success Banner */}
        <div className={`rounded-2xl p-8 text-center mb-6 ${isPassing ? 'bg-green-500' : 'bg-orange-500'} text-white`}>
          <div className="inline-flex items-center justify-center h-20 w-20 rounded-full bg-white/20 mb-4">
            <TrophyIcon className="h-10 w-10" />
          </div>
          <h1 className="text-3xl font-bold mb-2">
            {isPassing ? 'Congratulations!' : 'Quiz Completed!'}
          </h1>
          <p className="text-white/90">
            {isPassing 
              ? 'You passed the quiz successfully!' 
              : 'Keep practicing to improve your score!'}
          </p>
        </div>

        {/* Score Card */}
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">{result.quiz.title}</h2>
          
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="text-center p-4 bg-indigo-50 rounded-lg">
              <p className="text-4xl font-bold text-indigo-600">{percentage}%</p>
              <p className="text-sm text-gray-500">Score</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-4xl font-bold text-green-600">{result.score ?? 0}/{result.maxScore ?? 0}</p>
              <p className="text-sm text-gray-500">Correct</p>
            </div>
            <div className={`text-center p-4 rounded-lg ${
              result.violations?.length > 0 ? 'bg-red-50' : 'bg-gray-50'
            }`}>
              <p className={`text-4xl font-bold ${
                result.violations?.length > 0 ? 'text-red-600' : 'text-gray-400'
              }`}>{result.violations?.length || 0}</p>
              <p className="text-sm text-gray-500">Violations</p>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="flex items-center justify-center gap-1">
                <ClockIcon className="h-6 w-6 text-purple-600" />
              </div>
              <p className="text-sm text-gray-500 mt-1">
                {result.completedAt ? new Date(result.completedAt).toLocaleTimeString() : 'N/A'}
              </p>
            </div>
          </div>

          {/* Violations Section */}
          {result.violations && result.violations.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <h3 className="font-medium text-red-800 mb-3 flex items-center gap-2">
                <ExclamationTriangleIcon className="h-5 w-5" />
                Rule Violations ({result.violations.length})
              </h3>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {result.violations.map((v, i) => (
                  <div key={i} className="flex items-center justify-between bg-white p-2 rounded text-sm">
                    <span className={`px-2 py-1 text-xs font-medium rounded ${
                      v.type === 'tab_switch' ? 'bg-orange-100 text-orange-700' :
                      v.type === 'copy_attempt' ? 'bg-red-100 text-red-700' :
                      v.type === 'paste_attempt' ? 'bg-purple-100 text-purple-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {v.type === 'tab_switch' ? 'Tab Switch' :
                       v.type === 'copy_attempt' ? 'Copy Attempt' :
                       v.type === 'paste_attempt' ? 'Paste Attempt' :
                       v.type === 'right_click' ? 'Right Click' : v.type}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(v.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Teacher Feedback */}
          {result.teacherFeedback && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h3 className="font-medium text-blue-900 mb-2">Teacher Feedback</h3>
              <p className="text-blue-800">{result.teacherFeedback}</p>
              {result.teacherGrade !== undefined && (
                <p className="mt-2 text-sm text-blue-700">
                  Grade: <span className="font-bold">{result.teacherGrade}%</span>
                </p>
              )}
            </div>
          )}

          {/* Question Review */}
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Question Review</h3>
          <div className="space-y-4">
            {result.quiz.questions.map((question, qIndex) => {
              const userAnswer = result.answers.find(
                a => a.questionId === `${result.id.split('-')[0]}-q${qIndex}` || 
                     a.questionId.endsWith(`-q${qIndex}`)
              );
              const selectedIndex = userAnswer?.selectedAnswer ?? -1;
              const isCorrect = selectedIndex === question.correctAnswer;

              return (
                <div key={qIndex} className="border rounded-lg p-4">
                  <div className="flex items-start gap-3 mb-3">
                    {isCorrect ? (
                      <CheckCircleIcon className="h-6 w-6 text-green-500 flex-shrink-0" />
                    ) : (
                      <XCircleIcon className="h-6 w-6 text-red-500 flex-shrink-0" />
                    )}
                    <div>
                      <p className="font-medium text-gray-900">Question {qIndex + 1}</p>
                      <p className="text-gray-700">{question.text}</p>
                    </div>
                  </div>

                  <div className="ml-9 space-y-2">
                    {question.options.map((option, oIndex) => (
                      <div
                        key={oIndex}
                        className={`p-2 rounded-lg text-sm ${
                          oIndex === question.correctAnswer
                            ? 'bg-green-100 text-green-800 border border-green-300'
                            : oIndex === selectedIndex && !isCorrect
                            ? 'bg-red-100 text-red-800 border border-red-300'
                            : 'bg-gray-50 text-gray-600'
                        }`}
                      >
                        <span className="font-medium mr-2">{String.fromCharCode(65 + oIndex)}.</span>
                        {option}
                        {oIndex === question.correctAnswer && (
                          <span className="ml-2 text-green-600">(Correct)</span>
                        )}
                        {oIndex === selectedIndex && oIndex !== question.correctAnswer && (
                          <span className="ml-2 text-red-600">(Your answer)</span>
                        )}
                      </div>
                    ))}
                  </div>

                  {question.explanation && (
                    <div className="ml-9 mt-3 p-3 bg-blue-50 rounded-lg">
                      <p className="text-sm text-blue-800">
                        <span className="font-medium">Explanation:</span> {question.explanation}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-center gap-4">
          <button
            onClick={() => navigate('/dashboard/student')}
            className="inline-flex items-center gap-2 px-6 py-3 border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50"
          >
            <ArrowLeftIcon className="h-5 w-5" />
            Back to Dashboard
          </button>
          <Link
            to="/dashboard/student/join-quiz"
            className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Take Another Quiz
          </Link>
        </div>
      </div>
    </div>
  );
};

export default TeacherQuizResultsPage;

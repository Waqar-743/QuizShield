import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DataTable } from '../../../components/shared';
import api from '../../../services/api';
import {
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  AcademicCapIcon,
} from '@heroicons/react/24/outline';

interface QuizHistoryItem {
  _id: string;
  quizId: string;
  score: number | null;
  totalQuestions: number;
  correctAnswers: number | null;
  timeTaken: number;
  isCompleted: boolean;
  attemptedAt: string;
  quizTitle?: string;
  topicTitle?: string;
  courseTitle?: string;
  teacherGrade?: number;
  teacherFeedback?: string;
  reviewStatus?: 'pending' | 'reviewed';
}

const StudentQuizHistory = () => {
  const [attempts, setAttempts] = useState<QuizHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'passed' | 'failed'>('all');

  useEffect(() => {
    fetchQuizHistory();
  }, []);

  const fetchQuizHistory = async () => {
    setLoading(true);
    try {
      const response = await api.get('/quizzes/history');
      setAttempts(response.data.data || []);
    } catch (error) {
      // Mock data for development
      setAttempts([
        {
          _id: '1',
          quizId: 'q1',
          score: 85,
          totalQuestions: 10,
          correctAnswers: 8,
          timeTaken: 600,
          isCompleted: true,
          attemptedAt: new Date(Date.now() - 86400000).toISOString(),
          quizTitle: 'JavaScript Basics',
          topicTitle: 'Variables & Types',
          courseTitle: 'Web Development',
        },
        {
          _id: '2',
          quizId: 'q2',
          score: 60,
          totalQuestions: 10,
          correctAnswers: 6,
          timeTaken: 480,
          isCompleted: true,
          attemptedAt: new Date(Date.now() - 172800000).toISOString(),
          quizTitle: 'React Fundamentals',
          topicTitle: 'Components',
          courseTitle: 'Web Development',
        },
        {
          _id: '3',
          quizId: 'q3',
          score: 90,
          totalQuestions: 15,
          correctAnswers: 14,
          timeTaken: 720,
          isCompleted: true,
          attemptedAt: new Date(Date.now() - 259200000).toISOString(),
          quizTitle: 'Python Data Structures',
          topicTitle: 'Lists & Dictionaries',
          courseTitle: 'Python Programming',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const filteredAttempts = attempts.filter((attempt) => {
    const finalGrade = attempt.teacherGrade;
    if (filter === 'passed') return finalGrade !== undefined && finalGrade >= 70;
    if (filter === 'failed') return finalGrade !== undefined && finalGrade < 70;
    return true;
  });

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-100';
    if (score >= 60) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  };

  const columns = [
    {
      key: 'quizTitle' as keyof QuizHistoryItem,
      header: 'Quiz',
      render: (attempt: QuizHistoryItem) => (
        <div>
          <p className="font-medium text-gray-900">{attempt.quizTitle || 'Untitled Quiz'}</p>
          <p className="text-sm text-gray-500">{attempt.topicTitle}</p>
        </div>
      ),
    },
    {
      key: 'courseTitle' as keyof QuizHistoryItem,
      header: 'Course',
    },
    {
      key: 'score' as keyof QuizHistoryItem,
      header: 'Auto Score',
      render: (attempt: QuizHistoryItem) => (
        <div className="flex items-center gap-2">
          {attempt.reviewStatus === 'reviewed' && attempt.score !== null ? (
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium ${getScoreColor(
                attempt.score
              )}`}
            >
              {attempt.score}%
            </span>
          ) : (
            <span className="text-sm text-gray-400">Hidden until review</span>
          )}
        </div>
      ),
    },
    {
      key: 'teacherGrade' as keyof QuizHistoryItem,
      header: 'Teacher Grade',
      render: (attempt: QuizHistoryItem) => (
        <div className="flex items-center gap-2">
          {attempt.teacherGrade !== undefined ? (
            <>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium ${getScoreColor(attempt.teacherGrade)}`}>
                {attempt.teacherGrade}%
              </span>
              {attempt.teacherGrade >= 70 ? (
                <CheckCircleIcon className="h-5 w-5 text-green-500" />
              ) : (
                <XCircleIcon className="h-5 w-5 text-red-500" />
              )}
            </>
          ) : (
            <span className="text-sm text-gray-400">Pending</span>
          )}
        </div>
      ),
    },
    {
      key: 'correctAnswers' as keyof QuizHistoryItem,
      header: 'Correct',
      render: (attempt: QuizHistoryItem) => (
        <span className="text-gray-600">
          {attempt.reviewStatus === 'reviewed' && attempt.correctAnswers !== null
            ? `${attempt.correctAnswers}/${attempt.totalQuestions}`
            : 'Pending review'}
        </span>
      ),
    },
    {
      key: 'attemptedAt' as keyof QuizHistoryItem,
      header: 'Completed',
      render: (attempt: QuizHistoryItem) => (
        <div className="text-sm">
          <p className="text-gray-900">{formatDate(attempt.attemptedAt)}</p>
          <p className="text-gray-500 flex items-center gap-1">
            <ClockIcon className="h-3 w-3" />
            {formatDuration(attempt.timeTaken)}
          </p>
        </div>
      ),
    },
    {
      key: '_id' as keyof QuizHistoryItem,
      header: 'Actions',
      render: (attempt: QuizHistoryItem) => (
        <div className="flex gap-2">
          <Link
            to={`/quiz/teacher-results/${attempt._id}`}
            className="text-primary-700 hover:text-primary-900 text-sm font-medium"
          >
            View Details
          </Link>
        </div>
      ),
    },
  ];

  // Calculate stats
  const totalAttempts = attempts.length;
  const reviewedAttempts = attempts.filter((a) => a.teacherGrade !== undefined);
  const passedAttempts = reviewedAttempts.filter((a) => (a.teacherGrade || 0) >= 70).length;
  const avgScore = reviewedAttempts.length > 0
    ? Math.round(reviewedAttempts.reduce((sum, a) => sum + (a.teacherGrade || 0), 0) / reviewedAttempts.length)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Quiz History</h1>
        <p className="text-sm text-gray-500 mt-1">Review your past quiz attempts and track your progress.</p>
      </header>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-100 rounded-lg">
              <AcademicCapIcon className="h-6 w-6 text-primary-700" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Attempts</p>
              <p className="text-2xl font-bold text-gray-900">{totalAttempts}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircleIcon className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Passed</p>
              <p className="text-2xl font-bold text-gray-900">
                {passedAttempts} <span className="text-sm font-normal text-gray-500">({totalAttempts > 0 ? Math.round((passedAttempts / totalAttempts) * 100) : 0}%)</span>
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-100 rounded-lg">
              <ClockIcon className="h-6 w-6 text-primary-700" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Average Score</p>
              <p className="text-2xl font-bold text-gray-900">{avgScore}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            {(['all', 'passed', 'failed'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-6 py-3 text-sm font-medium border-b-2 ${
                  filter === tab
                    ? 'border-primary-500 text-primary-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                <span className="ml-2 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                  {tab === 'all'
                    ? totalAttempts
                    : tab === 'passed'
                    ? passedAttempts
                    : totalAttempts - passedAttempts}
                </span>
              </button>
            ))}
          </nav>
        </div>

        {/* Quiz Table */}
        <div className="p-4">
          <DataTable
            columns={columns}
            data={filteredAttempts}
            isLoading={loading}
            emptyMessage="No quiz attempts found"
          />
        </div>
      </div>
    </div>
  );
};

export default StudentQuizHistory;

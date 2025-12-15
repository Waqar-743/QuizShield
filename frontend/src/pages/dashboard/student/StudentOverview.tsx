import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../../store/authStore';
import { StatCard } from '../../../components/shared';
import api from '../../../services/api';
import {
  AcademicCapIcon,
  ChartBarIcon,
  FireIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface Notification {
  id: string;
  title: string;
  message: string;
  quiz_code: string;
  is_read: boolean;
  created_at: string;
}

interface StudentAnalytics {
  totalQuizzes: number;
  avgScore: number;
  passRate: number;
  streakDays: number;
  performanceData: { week: string; score: number }[];
}

const StudentOverview = () => {
  const { user } = useAuthStore();
  const [analytics, setAnalytics] = useState<StudentAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);

  useEffect(() => {
    fetchAnalytics();
    fetchNotifications();
    
    // Poll for new notifications every 10 seconds
    const pollInterval = setInterval(() => {
      fetchNotifications();
    }, 10000);
    
    return () => clearInterval(pollInterval);
  }, []);

  const fetchAnalytics = async () => {
    setAnalyticsLoading(true);
    try {
      const response = await api.get('/quizzes/student/analytics');
      setAnalytics(response.data.data);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
      setAnalytics({
        totalQuizzes: 0,
        avgScore: 0,
        passRate: 0,
        streakDays: 0,
        performanceData: [],
      });
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const fetchNotifications = async () => {
    setNotifLoading(true);
    try {
      const response = await api.get('/notifications');
      setNotifications(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      setNotifications([]);
    } finally {
      setNotifLoading(false);
    }
  };

  if (analyticsLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <header className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Welcome back, {user?.name}!</h1>
            <p className="mt-1 text-white/90">Ready to take a quiz? Enter a code shared by your teacher.</p>
            <div className="mt-4 flex items-center gap-4">
              <div className="flex items-center gap-2">
                <FireIcon className="h-5 w-5 text-orange-300" />
                <span className="font-medium">{analytics?.streakDays || 0} day streak</span>
              </div>
              <div className="h-4 w-px bg-white/30"></div>
              <span className="text-sm text-white/90">
                {analytics?.totalQuizzes || 0} quizzes completed
              </span>
            </div>
          </div>
          <Link
            to="/dashboard/student/join-quiz"
            className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 font-medium text-primary-700 transition-colors hover:bg-primary-50"
          >
            <AcademicCapIcon className="h-5 w-5" />
            Join Quiz
          </Link>
        </div>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={<AcademicCapIcon className="h-6 w-6" />}
          label="Quizzes Completed"
          value={analytics?.totalQuizzes || 0}
          color="green"
        />
        <StatCard
          icon={<ChartBarIcon className="h-6 w-6" />}
          label="Average Score"
          value={analytics?.avgScore ? `${analytics.avgScore}%` : 'N/A'}
          color="primary"
          trend={analytics?.avgScore && analytics.avgScore >= 60 ? 'up' : 'down'}
        />
        <StatCard
          icon={<FireIcon className="h-6 w-6" />}
          label="Learning Streak"
          value={`${analytics?.streakDays || 0} Days`}
          color="orange"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Performance Chart */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Trend</h3>
          {analytics?.performanceData && analytics.performanceData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analytics.performanceData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="week" stroke="#6b7280" fontSize={12} />
                  <YAxis stroke="#6b7280" fontSize={12} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="#4ca1af"
                    strokeWidth={2}
                    dot={{ fill: '#4ca1af', strokeWidth: 2 }}
                    activeDot={{ r: 8 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <ChartBarIcon className="h-12 w-12 mx-auto mb-2" />
                <p>Complete quizzes to see your performance trend</p>
              </div>
            </div>
          )}
        </div>

        {/* Notifications */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
            <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-primary-100 text-xs font-medium text-primary-700">
              {notifications.filter(n => !n.is_read).length}
            </span>
          </div>
          {notifLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-gray-100 rounded w-full"></div>
                </div>
              ))}
            </div>
          ) : notifications.length > 0 ? (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {notifications.slice(0, 5).map((notif) => (
                <div
                  key={notif.id}
                  className={`p-3 rounded-lg border-l-4 ${
                    notif.is_read
                      ? 'border-gray-300 bg-gray-50'
                      : 'border-primary-500 bg-primary-50'
                  }`}
                >
                  <p className="text-sm font-medium text-gray-900">{notif.title}</p>
                  <p className="text-xs text-gray-600 mt-1">{notif.message}</p>
                  {notif.quiz_code && (
                    <p className="mt-2 text-xs font-mono font-bold text-primary-700">
                      Code: {notif.quiz_code}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No notifications yet. Your teacher will notify you when a new quiz is available!</p>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Quick Actions</h3>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            to="/dashboard/student/join-quiz"
            className="flex items-center gap-4 rounded-xl bg-gradient-to-br from-primary-50 to-primary-100 p-4 transition-colors hover:from-primary-100 hover:to-primary-200"
          >
            <div className="rounded-lg bg-primary-100 p-3">
              <AcademicCapIcon className="h-8 w-8 text-primary-700" />
            </div>
            <div>
              <h4 className="font-medium text-gray-900">Join Quiz</h4>
              <p className="text-sm text-gray-500">Enter a code to take a quiz</p>
            </div>
            <ArrowRightIcon className="h-5 w-5 text-gray-400 ml-auto" />
          </Link>
          <Link
            to="/dashboard/student/quiz-history"
            className="flex items-center gap-4 p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl hover:from-green-100 hover:to-emerald-100 transition-colors"
          >
            <div className="p-3 bg-green-100 rounded-lg">
              <ChartBarIcon className="h-8 w-8 text-green-600" />
            </div>
            <div>
              <h4 className="font-medium text-gray-900">Quiz History</h4>
              <p className="text-sm text-gray-500">View your past quiz attempts</p>
            </div>
            <ArrowRightIcon className="h-5 w-5 text-gray-400 ml-auto" />
          </Link>
        </div>
      </div>
    </div>
  );
};

export default StudentOverview;

import { useEffect, useState } from 'react';
import { StatCard } from '../../../components/shared';
import api from '../../../services/api';
import {
  UserGroupIcon,
  AcademicCapIcon,
  ChartBarIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from 'recharts';

interface AnalyticsData {
  totalStudents: number;
  totalQuizzes: number;
  totalAttempts: number;
  avgScore: number;
  passRate: number;
  scoreDistribution: { range: string; count: number; color: string }[];
  weeklyData: { date: string; attempts: number; avgScore: number }[];
}

const TeacherAnalytics = () => {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const response = await api.get('/quizzes/teacher/analytics');
      setAnalytics(response.data.data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      setAnalytics({
        totalStudents: 0,
        totalQuizzes: 0,
        totalAttempts: 0,
        avgScore: 0,
        passRate: 0,
        scoreDistribution: [],
        weeklyData: [],
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  const hasData = analytics && analytics.totalAttempts > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Track student performance and engagement</p>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<UserGroupIcon className="h-6 w-6" />}
          label="Total Students"
          value={analytics?.totalStudents || 0}
          color="blue"
        />
        <StatCard
          icon={<AcademicCapIcon className="h-6 w-6" />}
          label="Quiz Attempts"
          value={analytics?.totalAttempts || 0}
          color="green"
        />
        <StatCard
          icon={<ChartBarIcon className="h-6 w-6" />}
          label="Average Score"
          value={`${analytics?.avgScore || 0}%`}
          color="purple"
          trend={analytics?.avgScore && analytics.avgScore >= 60 ? 'up' : 'down'}
        />
        <StatCard
          icon={<ClockIcon className="h-6 w-6" />}
          label="Pass Rate"
          value={`${analytics?.passRate || 0}%`}
          color="orange"
          trend={analytics?.passRate && analytics.passRate >= 60 ? 'up' : 'down'}
        />
      </div>

      {!hasData ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <AcademicCapIcon className="h-16 w-16 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Quiz Data Yet</h3>
          <p className="text-gray-500">
            Create quizzes and have students take them to see analytics data here.
          </p>
        </div>
      ) : (
        <>
          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Weekly Performance Trend */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Weekly Performance</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analytics?.weeklyData || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="date" stroke="#6b7280" fontSize={12} />
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
                      dataKey="avgScore"
                      stroke="#6366f1"
                      strokeWidth={2}
                      dot={{ fill: '#6366f1' }}
                      name="Avg Score %"
                    />
                    <Legend />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Score Distribution */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Score Distribution</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={analytics?.scoreDistribution || []}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="count"
                      label={({ range, count }: { range: string; count: number }) => `${range}: ${count}`}
                      labelLine={false}
                    >
                      {(analytics?.scoreDistribution || []).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Quiz Attempts by Week */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Weekly Quiz Attempts</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics?.weeklyData || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" stroke="#6b7280" fontSize={12} />
                  <YAxis stroke="#6b7280" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey="attempts" fill="#6366f1" name="Attempts" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-6 text-white">
              <h4 className="text-lg font-semibold mb-2">Pass Rate</h4>
              <p className="text-4xl font-bold">{analytics?.passRate || 0}%</p>
              <p className="text-green-100 mt-2">
                {analytics?.passRate && analytics.passRate >= 70 
                  ? 'Great job! Students are performing well.'
                  : 'Consider reviewing difficult topics.'}
              </p>
            </div>
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl p-6 text-white">
              <h4 className="text-lg font-semibold mb-2">Total Quizzes</h4>
              <p className="text-4xl font-bold">{analytics?.totalQuizzes || 0}</p>
              <p className="text-indigo-100 mt-2">Quizzes created and available</p>
            </div>
            <div className="bg-gradient-to-br from-orange-500 to-red-500 rounded-xl p-6 text-white">
              <h4 className="text-lg font-semibold mb-2">Engagement</h4>
              <p className="text-4xl font-bold">{analytics?.totalAttempts || 0}</p>
              <p className="text-orange-100 mt-2">Total quiz attempts by students</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default TeacherAnalytics;

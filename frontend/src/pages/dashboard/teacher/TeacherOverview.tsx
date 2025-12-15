import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../../store/authStore';
import { StatCard } from '../../../components/shared';
import api from '../../../services/api';
import {
  BookOpenIcon,
  UserGroupIcon,
  QuestionMarkCircleIcon,
  ChartBarIcon,
  PlusIcon,
  ArrowTrendingUpIcon,
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
} from 'recharts';

interface TeacherStats {
  totalCourses: number;
  totalStudents: number;
  totalQuestions: number;
  totalTopics: number;
  avgStudentScore: number;
  activeEnrollments: number;
}

interface CoursePerformance {
  courseName: string;
  avgScore: number;
  completionRate: number;
  enrollments: number;
}

const TeacherOverview = () => {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<TeacherStats | null>(null);
  const [coursePerformance, setCoursePerformance] = useState<CoursePerformance[]>([]);
  const [loading, setLoading] = useState(true);

  // Mock data for difficulty distribution
  const difficultyDistribution = [
    { name: 'Beginner', value: 35, color: '#10B981' },
    { name: 'Intermediate', value: 45, color: '#F59E0B' },
    { name: 'Advanced', value: 20, color: '#EF4444' },
  ];

  useEffect(() => {
    fetchTeacherStats();
  }, []);

  const fetchTeacherStats = async () => {
    setLoading(true);
    try {
      const [statsRes, performanceRes] = await Promise.all([
        api.get('/analytics/teacher/stats'),
        api.get('/analytics/teacher/course-performance'),
      ]);
      setStats(statsRes.data.data);
      setCoursePerformance(performanceRes.data.data || []);
    } catch (error) {
      // Mock data for development
      setStats({
        totalCourses: 5,
        totalStudents: 128,
        totalQuestions: 245,
        totalTopics: 32,
        avgStudentScore: 76.5,
        activeEnrollments: 89,
      });
      setCoursePerformance([
        { courseName: 'JavaScript Basics', avgScore: 82, completionRate: 75, enrollments: 45 },
        { courseName: 'React Fundamentals', avgScore: 78, completionRate: 68, enrollments: 38 },
        { courseName: 'Node.js Backend', avgScore: 71, completionRate: 52, enrollments: 28 },
        { courseName: 'Python for Beginners', avgScore: 85, completionRate: 82, enrollments: 52 },
        { courseName: 'Data Structures', avgScore: 68, completionRate: 45, enrollments: 21 },
      ]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
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
            <h1 className="text-2xl font-bold">Welcome, {user?.name}!</h1>
            <p className="mt-1 text-white/90">Create quizzes and share them with your students using access codes.</p>
          </div>
          <Link
            to="/dashboard/teacher/quizzes"
            className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 font-medium text-primary-700 transition-colors hover:bg-primary-50"
          >
            <PlusIcon className="h-5 w-5" />
            Create Quiz
          </Link>
        </div>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<BookOpenIcon className="h-6 w-6" />}
          label="Total Courses"
          value={stats?.totalCourses || 0}
          color="blue"
        />
        <StatCard
          icon={<UserGroupIcon className="h-6 w-6" />}
          label="Total Students"
          value={stats?.totalStudents || 0}
          color="green"
          trend="up"
          change={8}
        />
        <StatCard
          icon={<QuestionMarkCircleIcon className="h-6 w-6" />}
          label="Questions Created"
          value={stats?.totalQuestions || 0}
          color="primary"
        />
        <StatCard
          icon={<ChartBarIcon className="h-6 w-6" />}
          label="Avg. Student Score"
          value={`${stats?.avgStudentScore?.toFixed(1) || 0}%`}
          color="orange"
          trend={stats?.avgStudentScore && stats.avgStudentScore >= 70 ? 'up' : 'down'}
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Course Performance Chart */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Course Performance</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={coursePerformance} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" domain={[0, 100]} stroke="#6b7280" fontSize={12} />
                <YAxis
                  type="category"
                  dataKey="courseName"
                  stroke="#6b7280"
                  fontSize={12}
                  width={120}
                  tick={{ fill: '#374151' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                  }}
                />
                <Bar dataKey="avgScore" fill="#4ca1af" name="Avg Score %" radius={[0, 4, 4, 0]} />
                <Bar dataKey="completionRate" fill="#10b981" name="Completion %" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Difficulty Distribution */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Question Difficulty</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={difficultyDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {difficultyDistribution.map((entry, index) => (
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

      {/* Recent Activity & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Enrollments */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
            <Link
              to="/dashboard/teacher/analytics"
              className="text-sm font-medium text-primary-700 hover:text-primary-600"
            >
              View All
            </Link>
          </div>
          <div className="p-4">
            <div className="space-y-4">
              {[
                { type: 'enrollment', text: 'New student enrolled in JavaScript Basics', time: '2 hours ago' },
                { type: 'quiz', text: '15 students completed React Quiz #3', time: '5 hours ago' },
                { type: 'milestone', text: 'Python course reached 50 enrollments!', time: '1 day ago' },
              ].map((activity, index) => (
                <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="p-2 bg-primary-100 rounded-full">
                    <ArrowTrendingUpIcon className="h-4 w-4 text-primary-700" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-900">{activity.text}</p>
                    <p className="text-xs text-gray-500">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-4">
            <Link
              to="/dashboard/teacher/quizzes"
              className="flex flex-col items-center p-4 bg-gradient-to-br from-primary-50 to-primary-100 rounded-xl hover:from-primary-100 hover:to-primary-200 transition-colors"
            >
              <QuestionMarkCircleIcon className="h-8 w-8 text-primary-700 mb-2" />
              <span className="text-sm font-medium text-gray-900">Create Quiz</span>
            </Link>
            <Link
              to="/dashboard/teacher/analytics"
              className="flex flex-col items-center p-4 bg-gradient-to-br from-primary-50 to-primary-100 rounded-xl hover:from-primary-100 hover:to-primary-200 transition-colors"
            >
              <ChartBarIcon className="h-8 w-8 text-primary-700 mb-2" />
              <span className="text-sm font-medium text-gray-900">View Analytics</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeacherOverview;

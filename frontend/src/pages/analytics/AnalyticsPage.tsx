import React, { useEffect } from 'react';
import { useAnalytics } from '../../hooks/useAnalytics';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts';

const AnalyticsPage: React.FC = () => {
  const { stats, loading, fetchDashboardStats } = useAnalytics();

  useEffect(() => {
    fetchDashboardStats();
  }, [fetchDashboardStats]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  // Mock data
  const progressData = [
    { name: 'Week 1', score: 65 },
    { name: 'Week 2', score: 70 },
    { name: 'Week 3', score: 75 },
    { name: 'Week 4', score: stats?.averageScore || 80 },
  ];

  const activityData = [
    { name: 'Mon', quizzes: 1 },
    { name: 'Tue', quizzes: 2 },
    { name: 'Wed', quizzes: 0 },
    { name: 'Thu', quizzes: 3 },
    { name: 'Fri', quizzes: 1 },
    { name: 'Sat', quizzes: 4 },
    { name: 'Sun', quizzes: 2 },
  ];

  const masteryData = [
    { name: 'React', value: 85 },
    { name: 'Node.js', value: 70 },
    { name: 'TypeScript', value: 90 },
    { name: 'MongoDB', value: 60 },
  ];

  const COLORS = ['#4ca1af', '#00C49F', '#FFBB28', '#FF8042'];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Learning Analytics</h1>
      
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Progress Chart */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Performance Trend</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={progressData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="score" stroke="#4ca1af" activeDot={{ r: 8 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Activity Chart */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Weekly Activity</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={activityData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="quizzes" fill="#4ca1af" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Topic Mastery */}
        <div className="bg-white p-6 rounded-lg shadow lg:col-span-2">
          <div className="flex flex-col md:flex-row items-center justify-around">
            <div className="w-full md:w-1/2 h-64">
              <h3 className="text-lg font-medium text-gray-900 mb-4 text-center">Topic Mastery</h3>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={masteryData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {masteryData.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-full md:w-1/2 mt-6 md:mt-0 pl-0 md:pl-8">
              <h4 className="text-md font-medium text-gray-700 mb-2">Insights</h4>
              <ul className="list-disc list-inside space-y-2 text-gray-600">
                <li>You are performing exceptionally well in <strong>TypeScript</strong>.</li>
                <li>Consider reviewing <strong>MongoDB</strong> concepts to improve your score.</li>
                <li>Your learning streak is <strong>{stats?.streakDays || 0} days</strong>. Keep it up!</li>
                <li>You have completed <strong>{stats?.quizzesCompleted || 0}</strong> quizzes in total.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsPage;

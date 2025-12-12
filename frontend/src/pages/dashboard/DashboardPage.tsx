import React, { useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useAnalytics } from '../../hooks/useAnalytics';
import { useCourses } from '../../hooks/useCourses';
import { Link } from 'react-router-dom';
import { 
  BookOpenIcon, 
  AcademicCapIcon, 
  ChartBarIcon, 
  ClockIcon 
} from '@heroicons/react/24/outline';

const DashboardPage: React.FC = () => {
  const { user } = useAuthStore();
  const { stats, loading: statsLoading, fetchDashboardStats } = useAnalytics();
  const { courses: enrolledCourses, loading: coursesLoading, fetchEnrolledCourses } = useCourses();

  useEffect(() => {
    fetchDashboardStats();
    fetchEnrolledCourses();
  }, [fetchDashboardStats, fetchEnrolledCourses]);

  if (statsLoading || coursesLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-gray-900">Welcome back, {user?.name}!</h1>
        <p className="mt-1 text-sm text-gray-500">Here's what's happening with your learning journey.</p>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <BookOpenIcon className="h-6 w-6 text-gray-400" aria-hidden="true" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Courses Enrolled</dt>
                  <dd className="text-lg font-medium text-gray-900">{stats?.coursesEnrolled || 0}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <AcademicCapIcon className="h-6 w-6 text-gray-400" aria-hidden="true" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Quizzes Completed</dt>
                  <dd className="text-lg font-medium text-gray-900">{stats?.quizzesCompleted || 0}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ChartBarIcon className="h-6 w-6 text-gray-400" aria-hidden="true" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Average Score</dt>
                  <dd className="text-lg font-medium text-gray-900">{stats?.averageScore ? `${stats.averageScore.toFixed(1)}%` : 'N/A'}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ClockIcon className="h-6 w-6 text-gray-400" aria-hidden="true" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Learning Streak</dt>
                  <dd className="text-lg font-medium text-gray-900">{stats?.streakDays || 0} Days</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Courses */}
      <div className="bg-white shadow sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
          <h3 className="text-lg leading-6 font-medium text-gray-900">My Courses</h3>
          <Link to="/courses" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
            View all
          </Link>
        </div>
        <div className="border-t border-gray-200">
          {enrolledCourses.length > 0 ? (
            <ul role="list" className="divide-y divide-gray-200">
              {enrolledCourses.slice(0, 5).map((course) => (
                <li key={course._id}>
                  <Link to={`/courses/${course._id}`} className="block hover:bg-gray-50">
                    <div className="px-4 py-4 sm:px-6">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-indigo-600 truncate">{course.title}</p>
                        <div className="ml-2 flex-shrink-0 flex">
                          <p className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                            {course.difficulty}
                          </p>
                        </div>
                      </div>
                      <div className="mt-2 sm:flex sm:justify-between">
                        <div className="sm:flex">
                          <p className="flex items-center text-sm text-gray-500">
                            {course.description.substring(0, 100)}...
                          </p>
                        </div>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-6 text-center text-gray-500">
              You haven't enrolled in any courses yet. 
              <Link to="/courses" className="ml-1 text-indigo-600 hover:text-indigo-500">Browse courses</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;

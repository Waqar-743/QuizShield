import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCourses } from '../../../hooks/useCourses';
import { CourseCard } from '../../../components/shared';
import { Course } from '../../../types';
import api from '../../../services/api';
import toast from 'react-hot-toast';
import {
  MagnifyingGlassIcon,
  AdjustmentsHorizontalIcon,
  BookOpenIcon,
  PlusIcon,
  XMarkIcon,
  AcademicCapIcon,
} from '@heroicons/react/24/outline';

const StudentCourses = () => {
  const { courses: enrolledCourses, loading, fetchEnrolledCourses } = useCourses();
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'in-progress' | 'completed'>('all');
  const [filteredCourses, setFilteredCourses] = useState<Course[]>([]);

  // Join Course modal state
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [courseCode, setCourseCode] = useState('');
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    fetchEnrolledCourses();
  }, [fetchEnrolledCourses]);

  useEffect(() => {
    let result = enrolledCourses;

    if (searchTerm) {
      result = result.filter(
        (course) =>
          course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          course.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
          course.category.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filter === 'completed') {
      result = result.filter((course) => (course as any).progress === 100);
    } else if (filter === 'in-progress') {
      result = result.filter((course) => ((course as any).progress || 0) < 100);
    }

    setFilteredCourses(result);
  }, [enrolledCourses, searchTerm, filter]);

  const handleJoinCourse = async () => {
    const code = courseCode.trim().toUpperCase();
    if (!code) {
      toast.error('Please enter a course code');
      return;
    }

    setJoining(true);
    try {
      const response = await api.post('/courses/join-by-code', { courseCode: code });
      const result = response.data.data;
      toast.success(result.message || 'Enrolled successfully!');
      setShowJoinModal(false);
      setCourseCode('');
      fetchEnrolledCourses();
    } catch (error: any) {
      const message = error.response?.data?.message || error.response?.data?.error || 'Failed to join course';
      toast.error(message);
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Courses</h1>
          <p className="text-sm text-gray-500 mt-1">
            {enrolledCourses.length} course{enrolledCourses.length !== 1 ? 's' : ''} enrolled
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowJoinModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <PlusIcon className="h-5 w-5" />
            Join Course
          </button>
          <Link
            to="/courses"
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-colors shadow-sm"
          >
            Browse Courses
          </Link>
        </div>
      </header>

      {/* Join Course Card */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl shadow-sm p-6 text-white">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/20 rounded-lg backdrop-blur-sm">
              <AcademicCapIcon className="h-8 w-8 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Join a New Course</h2>
              <p className="text-indigo-100 text-sm mt-0.5">Enter the course code provided by your teacher to enroll</p>
            </div>
          </div>
          <button
            onClick={() => setShowJoinModal(true)}
            className="px-5 py-2.5 bg-white text-indigo-600 font-semibold rounded-lg hover:bg-indigo-50 transition-colors shadow-sm"
          >
            Enter Code
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search enrolled courses..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <AdjustmentsHorizontalIcon className="h-5 w-5 text-gray-400" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as 'all' | 'in-progress' | 'completed')}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="all">All Courses</option>
              <option value="in-progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Enrolled Courses heading */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Enrolled Courses</h2>
      </div>

      {/* Course Grid */}
      {filteredCourses.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCourses.map((course) => (
            <CourseCard
              key={course._id}
              course={course}
              progress={(course as any).progress}
            />
          ))}
        </div>
      ) : enrolledCourses.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <BookOpenIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Courses Yet</h3>
          <p className="text-gray-500 mb-4">
            Ask your teacher for a course code to get started, or browse available courses.
          </p>
          <button
            onClick={() => setShowJoinModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
          >
            <PlusIcon className="h-4 w-4" />
            Join with Code
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <MagnifyingGlassIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No courses found</h3>
          <p className="text-gray-500">Try adjusting your search or filter criteria.</p>
        </div>
      )}

      {/* Join Course Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 rounded-lg">
                  <AcademicCapIcon className="h-5 w-5 text-indigo-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Join Course</h3>
              </div>
              <button
                onClick={() => { setShowJoinModal(false); setCourseCode(''); }}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Modal body */}
            <div className="px-6 py-5 space-y-4">
              <p className="text-sm text-gray-600">
                Enter the 6-character course code provided by your teacher to enroll in the course.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Course Code</label>
                <input
                  type="text"
                  value={courseCode}
                  onChange={(e) => setCourseCode(e.target.value.toUpperCase().slice(0, 6))}
                  placeholder="e.g. AB3K7X"
                  maxLength={6}
                  className="w-full px-4 py-3 text-center text-2xl font-mono font-bold tracking-[0.3em] border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder:text-gray-300 placeholder:tracking-[0.3em] placeholder:text-lg uppercase"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter' && courseCode.length === 6) handleJoinCourse(); }}
                />
              </div>
            </div>

            {/* Modal footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => { setShowJoinModal(false); setCourseCode(''); }}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                onClick={handleJoinCourse}
                disabled={joining || courseCode.length < 6}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium text-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
              >
                {joining ? (
                  <>
                    <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                    Joining...
                  </>
                ) : (
                  'Join Course'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentCourses;

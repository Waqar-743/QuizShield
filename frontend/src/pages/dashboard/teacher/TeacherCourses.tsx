import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DataTable } from '../../../components/shared';
import api from '../../../services/api';
import toast from 'react-hot-toast';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';

interface TeacherCourse {
  _id: string;
  title: string;
  description: string;
  category: string;
  difficulty: string;
  thumbnail?: string;
  topics: string[];
  createdBy: string;
  enrollmentCount?: number;
  avgScore?: number;
  isPublished?: boolean;
}

const TeacherCourses = () => {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<TeacherCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [courseToDelete, setCourseToDelete] = useState<TeacherCourse | null>(null);

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    setLoading(true);
    try {
      const response = await api.get('/courses/teacher/my-courses');
      setCourses(response.data.data || []);
    } catch (error) {
      console.error('Error fetching courses:', error);
      setCourses([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (course: TeacherCourse) => {
    setCourseToDelete(course);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!courseToDelete) return;
    
    try {
      await api.delete(`/courses/${courseToDelete._id}`);
      toast.success('Course deleted successfully');
      setCourses(courses.filter((c) => c._id !== courseToDelete._id));
    } catch (error) {
      toast.error('Failed to delete course');
    } finally {
      setDeleteModalOpen(false);
      setCourseToDelete(null);
    }
  };

  const filteredCourses = courses.filter(
    (course) =>
      course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      course.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getDifficultyBadge = (difficulty: string) => {
    const styles: Record<string, string> = {
      beginner: 'bg-green-100 text-green-800',
      intermediate: 'bg-yellow-100 text-yellow-800',
      advanced: 'bg-red-100 text-red-800',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[difficulty] || 'bg-gray-100 text-gray-800'}`}>
        {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
      </span>
    );
  };

  const columns = [
    {
      key: 'title' as keyof TeacherCourse,
      header: 'Course',
      render: (course: TeacherCourse) => (
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-lg flex items-center justify-center">
            <span className="text-lg font-bold text-indigo-600">
              {course.title.charAt(0)}
            </span>
          </div>
          <div>
            <p className="font-medium text-gray-900">{course.title}</p>
            <p className="text-sm text-gray-500">{course.category}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'difficulty' as keyof TeacherCourse,
      header: 'Difficulty',
      render: (course: TeacherCourse) => getDifficultyBadge(course.difficulty),
    },
    {
      key: 'topics' as keyof TeacherCourse,
      header: 'Topics',
      render: (course: TeacherCourse) => (
        <span className="text-gray-600">{course.topics?.length || 0} topics</span>
      ),
    },
    {
      key: 'enrollmentCount' as keyof TeacherCourse,
      header: 'Students',
      render: (course: TeacherCourse) => (
        <div className="flex items-center gap-1 text-gray-600">
          <UserGroupIcon className="h-4 w-4" />
          <span>{course.enrollmentCount || 0}</span>
        </div>
      ),
    },
    {
      key: 'avgScore' as keyof TeacherCourse,
      header: 'Avg Score',
      render: (course: TeacherCourse) => (
        <span className={`font-medium ${
          (course.avgScore || 0) >= 80 ? 'text-green-600' :
          (course.avgScore || 0) >= 60 ? 'text-yellow-600' :
          'text-gray-400'
        }`}>
          {course.avgScore ? `${course.avgScore}%` : '-'}
        </span>
      ),
    },
    {
      key: 'isPublished' as keyof TeacherCourse,
      header: 'Status',
      render: (course: TeacherCourse) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
          course.isPublished ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
        }`}>
          {course.isPublished ? 'Published' : 'Draft'}
        </span>
      ),
    },
    {
      key: '_id' as keyof TeacherCourse,
      header: 'Actions',
      render: (course: TeacherCourse) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(`/courses/${course._id}`)}
            className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
            title="View"
          >
            <EyeIcon className="h-5 w-5" />
          </button>
          <button
            onClick={() => navigate(`/dashboard/teacher/courses/${course._id}/edit`)}
            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Edit"
          >
            <PencilIcon className="h-5 w-5" />
          </button>
          <button
            onClick={() => handleDelete(course)}
            className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Delete"
          >
            <TrashIcon className="h-5 w-5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Courses</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage your courses, topics, and content
          </p>
        </div>
        <Link
          to="/dashboard/teacher/courses/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
        >
          <PlusIcon className="h-5 w-5" />
          Create Course
        </Link>
      </header>

      {/* Search & Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search courses..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Courses Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <DataTable
          columns={columns}
          data={filteredCourses}
          isLoading={loading}
          emptyMessage="No courses found. Create your first course to get started!"
        />
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Course</h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to delete "{courseToDelete?.title}"? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteModalOpen(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherCourses;

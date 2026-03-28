import { useEffect, useState } from 'react';
import { DataTable } from '../../../components/shared';
import api from '../../../services/api';
import toast from 'react-hot-toast';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  TrashIcon,
  FolderIcon,
} from '@heroicons/react/24/outline';

interface TopicWithCourse {
  _id: string;
  title: string;
  description: string;
  courseId: string;
  order: number;
  courseName?: string;
  questionCount?: number;
}

interface CourseOption {
  _id: string;
  title: string;
  difficulty: string;
}

const TeacherTopics = () => {
  const [topics, setTopics] = useState<TopicWithCourse[]>([]);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCourse, setSelectedCourse] = useState<string>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTopic, setEditingTopic] = useState<TopicWithCourse | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    courseId: '',
    order: 1,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [topicsRes, coursesRes] = await Promise.all([
        api.get('/courses/teacher/topics'),
        api.get('/courses/teacher/my-courses'),
      ]);
      setTopics(topicsRes.data.data || []);
      setCourses(coursesRes.data.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      setTopics([]);
      setCourses([]);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (topic?: TopicWithCourse) => {
    if (courses.length === 0) {
      toast.error('Please create a course first before adding topics');
      return;
    }
    
    if (topic) {
      setEditingTopic(topic);
      setFormData({
        title: topic.title,
        description: topic.description,
        courseId: topic.courseId,
        order: topic.order,
      });
    } else {
      setEditingTopic(null);
      setFormData({
        title: '',
        description: '',
        courseId: courses[0]?._id || '',
        order: 1,
      });
    }
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingTopic) {
        await api.put(`/courses/topics/${editingTopic._id}`, formData);
        toast.success('Topic updated successfully');
      } else {
        await api.post('/courses/topics', formData);
        toast.success('Topic created successfully');
      }
      setModalOpen(false);
      fetchData();
    } catch (error) {
      toast.error('Failed to save topic');
    }
  };

  const handleDelete = async (topic: TopicWithCourse) => {
    if (!confirm(`Delete topic "${topic.title}"? This will also delete all associated questions.`)) return;
    
    try {
      await api.delete(`/courses/topics/${topic._id}`);
      toast.success('Topic deleted');
      setTopics(topics.filter((t) => t._id !== topic._id));
    } catch (error) {
      toast.error('Failed to delete topic');
    }
  };

  const filteredTopics = topics.filter((topic) => {
    const matchesSearch = topic.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      topic.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCourse = selectedCourse === 'all' || topic.courseId === selectedCourse;
    return matchesSearch && matchesCourse;
  });

  const columns = [
    {
      key: 'title' as keyof TopicWithCourse,
      header: 'Topic',
      render: (topic: TopicWithCourse) => (
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <FolderIcon className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <p className="font-medium text-gray-900">{topic.title}</p>
            <p className="text-sm text-gray-500 line-clamp-1">{topic.description}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'courseName' as keyof TopicWithCourse,
      header: 'Course',
      render: (topic: TopicWithCourse) => (
        <span className="text-gray-600">{topic.courseName || 'N/A'}</span>
      ),
    },
    {
      key: 'order' as keyof TopicWithCourse,
      header: 'Order',
      render: (topic: TopicWithCourse) => (
        <span className="inline-flex items-center justify-center w-8 h-8 bg-gray-100 rounded-full text-gray-600 font-medium">
          {topic.order}
        </span>
      ),
    },
    {
      key: 'questionCount' as keyof TopicWithCourse,
      header: 'Questions',
      render: (topic: TopicWithCourse) => (
        <span className="text-gray-600">{topic.questionCount || 0}</span>
      ),
    },
    {
      key: '_id' as keyof TopicWithCourse,
      header: 'Actions',
      render: (topic: TopicWithCourse) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleOpenModal(topic)}
            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Edit"
          >
            <PencilIcon className="h-5 w-5" />
          </button>
          <button
            onClick={() => handleDelete(topic)}
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
          <h1 className="text-2xl font-bold text-gray-900">Topics</h1>
          <p className="text-sm text-gray-500 mt-1">Manage topics for your courses</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
        >
          <PlusIcon className="h-5 w-5" />
          Add Topic
        </button>
      </header>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search topics..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <select
            value={selectedCourse}
            onChange={(e) => setSelectedCourse(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="all">All Courses</option>
            {courses.map((course) => (
              <option key={course._id} value={course._id}>
                {course.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Topics Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        {courses.length === 0 && !loading ? (
          <div className="p-8 text-center">
            <p className="text-gray-500 mb-4">You need to create a course before adding topics.</p>
            <a href="/dashboard/teacher/courses/new" className="text-indigo-600 hover:text-indigo-800 font-medium">
              Create your first course →
            </a>
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={filteredTopics}
            isLoading={loading}
            emptyMessage="No topics found. Click 'Add Topic' to create your first topic!"
          />
        )}
      </div>

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {editingTopic ? 'Edit Topic' : 'Add Topic'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Course</label>
                <select
                  value={formData.courseId}
                  onChange={(e) => setFormData({ ...formData, courseId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  required
                >
                  <option value="">Select a course</option>
                  {courses.map((course) => (
                    <option key={course._id} value={course._id}>
                      {course.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Order</label>
                <input
                  type="number"
                  min="1"
                  value={formData.order}
                  onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  required
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700"
                >
                  {editingTopic ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherTopics;

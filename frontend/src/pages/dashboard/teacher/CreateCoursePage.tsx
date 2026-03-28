import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import api from '../../../services/api';
import toast from 'react-hot-toast';

const CreateCoursePage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'Web Development',
    difficulty: 'Beginner',
  });

  const categories = [
    'Web Development',
    'Mobile Development',
    'Data Science',
    'Machine Learning',
    'DevOps',
    'Cybersecurity',
    'Database',
    'Cloud Computing',
    'Programming Languages',
    'Software Engineering',
    'Other',
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      toast.error('Please enter a course title');
      return;
    }

    setLoading(true);
    try {
      await api.post('/courses', {
        ...formData,
        description: formData.description || `Learn ${formData.title}`,
      });
      toast.success('Course created successfully!');
      navigate('/dashboard/teacher/courses');
    } catch (error: any) {
      console.error('Create course error:', error);
      const errorData = error.response?.data;
      const status = error.response?.status;
      const message = errorData?.message || errorData?.error?.message || errorData?.error || 'Failed to create course';
      
      // Show detailed error
      alert(`Error ${status}: ${message}\n\nFull error: ${JSON.stringify(errorData, null, 2)}`);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/dashboard/teacher/courses')}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-2" />
          Back to Courses
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Create New Course</h1>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-5">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Course Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="e.g., JavaScript Fundamentals"
            required
            autoFocus
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="Brief description of the course (optional)"
          />
        </div>

        {/* Category & Difficulty */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category
            </label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Difficulty
            </label>
            <select
              value={formData.difficulty}
              onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="Beginner">Beginner</option>
              <option value="Intermediate">Intermediate</option>
              <option value="Advanced">Advanced</option>
            </select>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={() => navigate('/dashboard/teacher/courses')}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || !formData.title.trim()}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {loading ? (
              <>
                <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                Creating...
              </>
            ) : (
              'Create Course'
            )}
          </button>
        </div>
      </form>

      {/* Help text */}
      <p className="text-sm text-gray-500 mt-4 text-center">
        After creating a course, you can add topics and questions from the Topics section.
      </p>
    </div>
  );
};

export default CreateCoursePage;

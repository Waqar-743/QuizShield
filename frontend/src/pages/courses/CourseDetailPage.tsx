import React, { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useCourses } from '../../hooks/useCourses';
import { BookOpenIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

const CourseDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { 
    currentCourse, 
    topics, 
    loading, 
    error, 
    fetchCourseById, 
    enrollInCourse 
  } = useCourses();

  useEffect(() => {
    if (id) {
      fetchCourseById(id);
    }
  }, [id, fetchCourseById]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (error || !currentCourse) {
    return (
      <div className="bg-red-50 border-l-4 border-red-400 p-4">
        <div className="flex">
          <div className="ml-3">
            <p className="text-sm text-red-700">{error || 'Course not found'}</p>
            <Link to="/courses" className="text-sm font-medium text-red-700 hover:text-red-600 mt-2 inline-block">
              &larr; Back to Courses
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Course Header */}
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{currentCourse.title}</h1>
              <p className="mt-1 max-w-2xl text-sm text-gray-500">{currentCourse.category} • {currentCourse.difficulty}</p>
            </div>
            <button
              onClick={() => id && enrollInCourse(id)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Enroll Now
            </button>
          </div>
        </div>
        <div className="border-t border-gray-200 px-4 py-5 sm:px-6">
          <dl className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <dt className="text-sm font-medium text-gray-500">Description</dt>
              <dd className="mt-1 text-sm text-gray-900">{currentCourse.description}</dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Topics List */}
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Course Topics</h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">Master these topics to complete the course.</p>
        </div>
        <div className="border-t border-gray-200">
          <ul role="list" className="divide-y divide-gray-200">
            {topics.map((topic, index) => (
              <li key={topic._id}>
                <div className="px-4 py-4 sm:px-6 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
                        {index + 1}
                      </div>
                      <div className="ml-4">
                        <h4 className="text-lg font-medium text-gray-900">{topic.title}</h4>
                        <p className="text-sm text-gray-500">{topic.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <Link
                        to={`/topics/${topic._id}`}
                        className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      >
                        <BookOpenIcon className="-ml-0.5 mr-2 h-4 w-4 text-gray-500" aria-hidden="true" />
                        Study
                      </Link>
                      <Link
                        to={`/quiz/start/${topic._id}`}
                        className="inline-flex items-center px-3 py-1.5 border border-transparent shadow-sm text-xs font-medium rounded text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      >
                        <CheckCircleIcon className="-ml-0.5 mr-2 h-4 w-4" aria-hidden="true" />
                        Take Quiz
                      </Link>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default CourseDetailPage;

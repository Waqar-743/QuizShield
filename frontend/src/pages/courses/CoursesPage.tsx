import React, { useEffect, useState, useMemo } from 'react';
import { useCourses } from '../../hooks/useCourses';
import { Link } from 'react-router-dom';
import { MagnifyingGlassIcon, FunnelIcon } from '@heroicons/react/24/outline';

const CoursesPage: React.FC = () => {
  const { courses, loading, error, fetchCourses } = useCourses();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('All');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  const filteredCourses = useMemo(() => {
    return courses.filter(course => {
      const matchesSearch = course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          course.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesDifficulty = selectedDifficulty === 'All' || course.difficulty === selectedDifficulty;
      const matchesCategory = selectedCategory === 'All' || course.category === selectedCategory;
      
      return matchesSearch && matchesDifficulty && matchesCategory;
    });
  }, [courses, searchTerm, selectedDifficulty, selectedCategory]);

  const categories = useMemo(() => {
    const cats = new Set(courses.map(c => c.category));
    return ['All', ...Array.from(cats)];
  }, [courses]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border-l-4 border-red-400 p-4">
        <div className="flex">
          <div className="ml-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold text-gray-900">Available Courses</h1>
      </div>

      {/* Filters and Search */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 space-y-4 sm:space-y-0 sm:flex sm:items-center sm:space-x-4">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            placeholder="Search courses..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <FunnelIcon className="h-5 w-5 text-gray-400" />
          <select
            value={selectedDifficulty}
            onChange={(e) => setSelectedDifficulty(e.target.value)}
            className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
          >
            <option value="All">All Difficulties</option>
            <option value="Beginner">Beginner</option>
            <option value="Intermediate">Intermediate</option>
            <option value="Advanced">Advanced</option>
          </select>
          
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
          >
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat === 'All' ? 'All Categories' : cat}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {filteredCourses.map((course) => (
          <div key={course._id} className="bg-white overflow-hidden shadow rounded-lg flex flex-col hover:shadow-md transition-shadow duration-200">
            <div className="p-5 flex-1">
              <div className="flex items-center justify-between mb-4">
                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                  ${course.difficulty === 'Beginner' ? 'bg-green-100 text-green-800' : 
                    course.difficulty === 'Intermediate' ? 'bg-yellow-100 text-yellow-800' : 
                    'bg-red-100 text-red-800'}`}>
                  {course.difficulty}
                </span>
                <span className="text-sm text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{course.category}</span>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">{course.title}</h3>
              <p className="text-sm text-gray-500 mb-4 line-clamp-3">{course.description}</p>
            </div>
            <div className="bg-gray-50 px-5 py-3">
              <Link
                to={`/courses/${course._id}`}
                className="block w-full text-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                View Course
              </Link>
            </div>
          </div>
        ))}
      </div>
      
      {filteredCourses.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg shadow-sm border border-gray-200">
          <p className="text-gray-500 text-lg">No courses found matching your criteria.</p>
          <button 
            onClick={() => {setSearchTerm(''); setSelectedDifficulty('All'); setSelectedCategory('All');}}
            className="mt-2 text-indigo-600 hover:text-indigo-500 font-medium"
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
};

export default CoursesPage;

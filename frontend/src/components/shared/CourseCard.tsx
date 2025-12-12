import React from 'react';
import { Course } from '../../types';
import { BookOpenIcon, UserGroupIcon, AcademicCapIcon } from '@heroicons/react/24/outline';

interface CourseCardProps {
  course: Course;
  progress?: number;
  enrolledCount?: number;
  onContinue?: () => void;
  onView?: () => void;
  onEdit?: () => void;
  onManageTopics?: () => void;
  variant?: 'student' | 'teacher';
  isLoading?: boolean;
}

const difficultyColors = {
  Beginner: 'bg-green-100 text-green-800',
  Intermediate: 'bg-yellow-100 text-yellow-800',
  Advanced: 'bg-red-100 text-red-800',
};

const CourseCard: React.FC<CourseCardProps> = ({
  course,
  progress = 0,
  enrolledCount,
  onContinue,
  onView,
  onEdit,
  onManageTopics,
  variant = 'student',
  isLoading = false,
}) => {
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-3/4 mb-3"></div>
        <div className="h-3 bg-gray-200 rounded w-full mb-2"></div>
        <div className="h-3 bg-gray-200 rounded w-2/3 mb-4"></div>
        <div className="flex space-x-2 mb-4">
          <div className="h-6 bg-gray-200 rounded w-16"></div>
          <div className="h-6 bg-gray-200 rounded w-20"></div>
        </div>
        <div className="h-2 bg-gray-200 rounded w-full mb-4"></div>
        <div className="h-9 bg-gray-200 rounded w-full"></div>
      </div>
    );
  }

  const difficulty = course.difficulty || course.difficultyLevel || 'Beginner';

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
      {/* Title */}
      <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-1">
        {course.title}
      </h3>

      {/* Description */}
      <p className="text-sm text-gray-500 mb-3 line-clamp-2">
        {course.description}
      </p>

      {/* Tags */}
      <div className="flex flex-wrap gap-2 mb-4">
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
          {course.category}
        </span>
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${difficultyColors[difficulty as keyof typeof difficultyColors]}`}>
          {difficulty}
        </span>
      </div>

      {/* Stats */}
      <div className="flex items-center text-sm text-gray-500 mb-4 space-x-4">
        <span className="flex items-center">
          <BookOpenIcon className="h-4 w-4 mr-1" />
          {course.topics?.length || 0} topics
        </span>
        {enrolledCount !== undefined && (
          <span className="flex items-center">
            <UserGroupIcon className="h-4 w-4 mr-1" />
            {enrolledCount} students
          </span>
        )}
      </div>

      {/* Progress bar (student variant) */}
      {variant === 'student' && (
        <div className="mb-4">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Progress</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-primary-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        {variant === 'student' && onContinue && (
          <button
            onClick={onContinue}
            className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-primary-600 hover:bg-primary-700"
          >
            <AcademicCapIcon className="h-4 w-4 mr-1" />
            Continue
          </button>
        )}
        {variant === 'teacher' && (
          <>
            {onView && (
              <button
                onClick={onView}
                className="flex-1 inline-flex justify-center items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50"
              >
                View
              </button>
            )}
            {onEdit && (
              <button
                onClick={onEdit}
                className="flex-1 inline-flex justify-center items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50"
              >
                Edit
              </button>
            )}
            {onManageTopics && (
              <button
                onClick={onManageTopics}
                className="flex-1 inline-flex justify-center items-center px-3 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700"
              >
                Topics
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default CourseCard;

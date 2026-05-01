import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

/**
 * Redirects to the role-specific dashboard courses page.
 * Previously this was a standalone page, but all courses management
 * now lives inside the proper dashboard layouts.
 */
const CoursesPage: React.FC = () => {
  const { user, isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.role === 'teacher' || user?.role === 'admin') {
    return <Navigate to="/dashboard/teacher/courses" replace />;
  }

  return <Navigate to="/dashboard/student/courses" replace />;
};

export default CoursesPage;

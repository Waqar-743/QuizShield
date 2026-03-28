import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

const TeacherRoute = () => {
  const { user, isAuthChecking } = useAuthStore();

  if (isAuthChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== 'teacher' && user.role !== 'admin') {
    // Redirect non-teachers to their appropriate dashboard
    if (user.role === 'student') {
      return <Navigate to="/dashboard/student" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
};

export default TeacherRoute;

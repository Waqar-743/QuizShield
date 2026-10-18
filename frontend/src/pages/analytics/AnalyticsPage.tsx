import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

// Keep the legacy URL useful without rendering fabricated charts.
export default function AnalyticsPage() {
  const {user}=useAuthStore();
  return <Navigate to={user?.role==='admin'?'/dashboard/admin':user?.role==='teacher'?'/dashboard/teacher/analytics':'/dashboard/student'} replace />;
}

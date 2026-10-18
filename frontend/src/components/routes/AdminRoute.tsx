import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
export default function AdminRoute() {
  const { user, isAuthChecking } = useAuthStore();
  if (isAuthChecking)
    return (
      <p role="status" className="p-8">
        Checking administrator access…
      </p>
    );
  if (!user) return <Navigate to="/admin/login" replace />;
  if (user.role !== "admin")
    return <Navigate to={`/dashboard/${user.role}`} replace />;
  return <Outlet />;
}

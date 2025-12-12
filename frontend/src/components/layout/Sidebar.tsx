import { Link, useLocation } from 'react-router-dom';
import { FiHome, FiBook, FiBarChart2, FiUser, FiX, FiRefreshCw } from 'react-icons/fi';
import clsx from 'clsx';
import { useAuthStore } from '../../store/authStore';
import toast from 'react-hot-toast';

interface SidebarProps {
  isOpen: boolean;
  closeSidebar: () => void;
}

const Sidebar = ({ isOpen, closeSidebar }: SidebarProps) => {
  const location = useLocation();
  const { user, switchRole, isLoading } = useAuthStore();

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: FiHome },
    { name: 'Courses', href: '/courses', icon: FiBook },
    { name: 'Analytics', href: '/analytics', icon: FiBarChart2 },
    { name: 'Profile', href: '/profile', icon: FiUser },
  ];

  const handleSwitchRole = async () => {
    const newRole = user?.role === 'teacher' ? 'student' : 'teacher';
    try {
      await switchRole(newRole);
      toast.success(`Switched to ${newRole} mode!`);
      window.location.href = '/dashboard';
    } catch {
      toast.error('Failed to switch role');
    }
  };

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className={clsx(
          'fixed inset-0 z-20 bg-gray-600 bg-opacity-75 transition-opacity lg:hidden',
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        onClick={closeSidebar}
      />

      {/* Sidebar component */}
      <div
        className={clsx(
          'fixed inset-y-0 left-0 z-30 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200 lg:hidden">
          <span className="text-xl font-bold text-primary-600">Adaptive Learning</span>
          <button
            onClick={closeSidebar}
            className="text-gray-500 hover:text-gray-600 focus:outline-none"
          >
            <FiX className="h-6 w-6" />
          </button>
        </div>

        <nav className="mt-5 px-4 space-y-1">
          {navigation.map((item) => {
            const isActive = location.pathname.startsWith(item.href);
            return (
              <Link
                key={item.name}
                to={item.href}
                className={clsx(
                  'group flex items-center px-2 py-2 text-base font-medium rounded-md transition-colors',
                  isActive
                    ? 'bg-primary-50 text-primary-600'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                )}
                onClick={() => {
                  if (window.innerWidth < 1024) closeSidebar();
                }}
              >
                <item.icon
                  className={clsx(
                    'mr-4 h-6 w-6 flex-shrink-0',
                    isActive ? 'text-primary-600' : 'text-gray-400 group-hover:text-gray-500'
                  )}
                />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Role Switch Button */}
        {user && (
          <div className="absolute bottom-4 left-4 right-4">
            <div className="text-xs text-gray-500 mb-2 px-2">
              Current role: <span className="font-medium capitalize">{user.role}</span>
            </div>
            <button
              onClick={handleSwitchRole}
              disabled={isLoading}
              className="w-full flex items-center px-2 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 rounded-md transition-colors disabled:opacity-50"
            >
              <FiRefreshCw className={clsx('mr-3 h-5 w-5 text-gray-400', isLoading && 'animate-spin')} />
              Switch to {user.role === 'teacher' ? 'Student' : 'Teacher'}
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default Sidebar;

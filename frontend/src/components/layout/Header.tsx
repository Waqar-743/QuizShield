import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { FiMenu, FiBell } from 'react-icons/fi';
import { useState } from 'react';

interface HeaderProps {
  toggleSidebar: () => void;
}

const Header = ({ toggleSidebar }: HeaderProps) => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="bg-white shadow-sm z-10">
      <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center">
          <button
            onClick={toggleSidebar}
            className="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500 lg:hidden"
          >
            <span className="sr-only">Open sidebar</span>
            <FiMenu className="h-6 w-6" />
          </button>
          <div className="hidden lg:flex lg:items-center lg:ml-4">
            <span className="text-xl font-bold text-primary-600">Adaptive Learning</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button className="p-2 rounded-full text-gray-400 hover:text-gray-500 hover:bg-gray-100">
            <span className="sr-only">View notifications</span>
            <FiBell className="h-6 w-6" />
          </button>

          {/* Profile dropdown */}
          <div className="relative ml-3">
            <div>
              <button
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="flex items-center max-w-xs text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                <span className="sr-only">Open user menu</span>
                <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold">
                  {user?.name?.charAt(0).toUpperCase() || 'U'}
                </div>
                <span className="ml-2 hidden md:block font-medium text-gray-700">
                  {user?.name}
                </span>
              </button>
            </div>

            {isProfileOpen && (
              <div className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 bg-white ring-1 ring-black ring-opacity-5 focus:outline-none">
                <Link
                  to="/profile"
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  onClick={() => setIsProfileOpen(false)}
                >
                  Your Profile
                </Link>
                <Link
                  to="/settings"
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  onClick={() => setIsProfileOpen(false)}
                >
                  Settings
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full text-left block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;

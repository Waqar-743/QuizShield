import React, { useState, useEffect } from 'react';
import { Outlet, Link } from 'react-router-dom';
import {
  Bars3Icon,
  BellIcon,
  UserCircleIcon,
  HomeIcon,
  AcademicCapIcon,
  ChartBarIcon,
  QuestionMarkCircleIcon,
  ClipboardDocumentListIcon,
} from '@heroicons/react/24/outline';
import RoleSidebar, { SidebarItem } from './RoleSidebar';
import Brand from './Brand';
import ChatbotWidget from './ChatbotWidget';
import { useAuthStore } from '../../store/authStore';
import api from '../../services/api';

interface Notification {
  id: string;
  title: string;
  message: string;
  quiz_code?: string;
  is_read: boolean;
  created_at: string;
}

interface DashboardLayoutProps {
  role: 'student' | 'teacher' | 'admin';
}

const getStudentSidebarItems = (): SidebarItem[] => [
  { label: 'Overview', href: '/dashboard/student', icon: <HomeIcon className="h-5 w-5" /> },
  { label: 'Enter Quiz Code', href: '/dashboard/student/join-quiz', icon: <AcademicCapIcon className="h-5 w-5" /> },
  { label: 'Quiz History', href: '/dashboard/student/quiz-history', icon: <ChartBarIcon className="h-5 w-5" /> },
];

const getTeacherSidebarItems = (): SidebarItem[] => [
  { label: 'Overview', href: '/dashboard/teacher', icon: <HomeIcon className="h-5 w-5" /> },
  { label: 'Create Quiz', href: '/dashboard/teacher/quizzes', icon: <QuestionMarkCircleIcon className="h-5 w-5" /> },
  { label: 'Submissions', href: '/dashboard/teacher/submissions', icon: <ClipboardDocumentListIcon className="h-5 w-5" /> },
  { label: 'Analytics', href: '/dashboard/teacher/analytics', icon: <ChartBarIcon className="h-5 w-5" /> },
];

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ role }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuthStore();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const sidebarItems = role === 'teacher' || role === 'admin' 
    ? getTeacherSidebarItems() 
    : getStudentSidebarItems();

  // Fetch notifications
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const response = await api.get('/notifications');
        const notifs = response.data.data || [];
        setNotifications(notifs);
        setUnreadCount(notifs.filter((n: Notification) => !n.is_read).length);
      } catch (error) {
        console.error('Error fetching notifications:', error);
      }
    };

    fetchNotifications();
    // Poll every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const markAsRead = async (notificationId: string) => {
    try {
      await api.put(`/notifications/${notificationId}/read`);
      setNotifications(notifications.map(n => 
        n.id === notificationId ? { ...n, is_read: true } : n
      ));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.put('/notifications/mark-all-read');
      setNotifications(notifications.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <RoleSidebar
        items={sidebarItems}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        role={role}
      />

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top navbar */}
        <header className="bg-white shadow-sm border-b border-gray-200 z-10">
          <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
            {/* Left side */}
            <div className="flex items-center">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100"
              >
                <Bars3Icon className="h-6 w-6" />
              </button>
              <div className="ml-2 lg:ml-0 flex items-center gap-3">
                <Brand
                  to="/"
                  textClassName="text-lg font-semibold text-gray-900"
                  iconWrapperClassName="bg-primary-50 ring-1 ring-primary-100"
                  iconClassName="h-5 w-5 text-primary-700"
                />
                <span className="hidden sm:inline text-sm text-gray-500">/</span>
                <h1 className="hidden sm:block text-lg font-semibold text-gray-900 capitalize">
                  {role} Dashboard
                </h1>
              </div>
            </div>

            {/* Right side */}
            <div className="flex items-center space-x-4">
              {/* Notifications */}
              <div className="relative">
                <button 
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="p-2 rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-100 relative"
                >
                  <BellIcon className="h-6 w-6" />
                  {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 h-5 w-5 bg-red-500 rounded-full flex items-center justify-center text-xs text-white font-bold">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {showNotifications && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowNotifications(false)}
                    />
                    <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-100 z-20 max-h-96 overflow-hidden">
                      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                        <h3 className="font-semibold text-gray-900">Notifications</h3>
                        {unreadCount > 0 && (
                          <button 
                            onClick={markAllAsRead}
                            className="text-xs text-primary-700 hover:text-primary-900"
                          >
                            Mark all read
                          </button>
                        )}
                      </div>
                      <div className="overflow-y-auto max-h-72">
                        {notifications.length === 0 ? (
                          <div className="px-4 py-8 text-center text-gray-500">
                            <BellIcon className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                            <p className="text-sm">No notifications yet</p>
                          </div>
                        ) : (
                          notifications.slice(0, 10).map((notif) => (
                            <div
                              key={notif.id}
                              onClick={() => !notif.is_read && markAsRead(notif.id)}
                              className={`px-4 py-3 border-b border-gray-50 cursor-pointer hover:bg-gray-50 ${
                                !notif.is_read ? 'bg-primary-50' : ''
                              }`}
                            >
                              <p className="text-sm font-medium text-gray-900">{notif.title}</p>
                              <p className="text-xs text-gray-600 mt-1 line-clamp-2">{notif.message}</p>
                              {notif.quiz_code && (
                                <p className="text-xs font-mono font-bold text-primary-700 mt-1">
                                  Code: {notif.quiz_code}
                                </p>
                              )}
                              <p className="text-xs text-gray-400 mt-1">
                                {new Date(notif.created_at).toLocaleString()}
                              </p>
                            </div>
                          ))
                        )}
                      </div>
                      {role === 'student' && (
                        <Link
                          to="/dashboard/student/join-quiz"
                          onClick={() => setShowNotifications(false)}
                          className="block px-4 py-3 text-center text-sm text-primary-700 hover:bg-gray-50 border-t"
                        >
                          Join a Quiz
                        </Link>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* User menu */}
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-100"
                >
                  <UserCircleIcon className="h-8 w-8 text-gray-400" />
                  <span className="hidden sm:block text-sm font-medium text-gray-700">
                    {user?.name}
                  </span>
                </button>

                {showUserMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowUserMenu(false)}
                    />
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-20">
                      <div className="px-4 py-2 border-b border-gray-100">
                        <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                        <p className="text-xs text-gray-500">{user?.email}</p>
                      </div>
                      <a
                        href="/profile"
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        Profile Settings
                      </a>
                      <button
                        onClick={logout}
                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-50"
                      >
                        Sign out
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>

      <ChatbotWidget />
    </div>
  );
};

export default DashboardLayout;

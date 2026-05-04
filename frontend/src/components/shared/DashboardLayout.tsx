import React, { useState, useEffect, useRef } from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import RoleSidebar, { SidebarItem } from './RoleSidebar';
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

const Stroke = ({ d, size = 18 }: { d: string; size?: number }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d={d} />
  </svg>
);

const studentItems: SidebarItem[] = [
  { label: 'Overview', href: '/dashboard/student', icon: <Stroke d="M3 11l9-7 9 7v9a2 2 0 0 1-2 2h-4v-6h-6v6H5a2 2 0 0 1-2-2v-9z" /> },
  { label: 'Courses', href: '/dashboard/student/courses', icon: <Stroke d="M4 5a2 2 0 0 1 2-2h11v17H6a2 2 0 0 1-2-2V5z M9 3v17 M17 7H9 M17 11H9" /> },
  { label: 'Enter Quiz Code', href: '/dashboard/student/join-quiz', icon: <Stroke d="M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h2v2h-2z M18 14h2v2h-2z M14 18h2v2h-2z M18 18h2v2h-2z" /> },
  { label: 'Quiz History', href: '/dashboard/student/quiz-history', icon: <Stroke d="M3 12a9 9 0 1 0 3-6.7 M3 4v5h5 M12 8v4l3 2" /> },
];

const teacherItems: SidebarItem[] = [
  { label: 'Overview', href: '/dashboard/teacher', icon: <Stroke d="M3 11l9-7 9 7v9a2 2 0 0 1-2 2h-4v-6h-6v6H5a2 2 0 0 1-2-2v-9z" /> },
  { label: 'Courses', href: '/dashboard/teacher/courses', icon: <Stroke d="M4 5a2 2 0 0 1 2-2h11v17H6a2 2 0 0 1-2-2V5z M9 3v17 M17 7H9 M17 11H9" /> },
  { label: 'Quizzes', href: '/dashboard/teacher/quizzes', icon: <Stroke d="M9 11l3 3 7-7 M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h10" /> },
  { label: 'Questions', href: '/dashboard/teacher/questions', icon: <Stroke d="M9 9a3 3 0 1 1 4.3 2.7c-.8.4-1.3 1-1.3 2V14 M12 18h.01 M3 12a9 9 0 1 1 18 0 9 9 0 0 1-18 0z" /> },
  { label: 'Submissions', href: '/dashboard/teacher/submissions', icon: <Stroke d="M9 3h6l2 4H7l2-4z M5 7h14v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7z M9 12h6 M9 16h4" /> },
  { label: 'Analytics', href: '/dashboard/teacher/analytics', icon: <Stroke d="M3 21h18 M6 17V9 M11 17V5 M16 17v-7 M21 17v-3" /> },
];

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ role }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const sidebarItems = role === 'teacher' || role === 'admin' ? teacherItems : studentItems;

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
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const markAsRead = async (notificationId: string) => {
    try {
      await api.put(`/notifications/${notificationId}/read`);
      setNotifications(notifications.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error(error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.put('/notifications/mark-all-read');
      setNotifications(notifications.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error(error);
    }
  };

  const handleSignOut = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex min-h-[100dvh] bg-ink-50 overflow-hidden relative">
      {/* Subtle ambient mesh */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-[0.5]"
        style={{
          background:
            'radial-gradient(60% 40% at 80% 0%, rgba(16,185,129,0.06) 0%, transparent 60%), radial-gradient(40% 30% at 0% 100%, rgba(6,182,212,0.05) 0%, transparent 60%)',
        }}
      />

      <RoleSidebar
        items={sidebarItems}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        role={role}
      />

      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Floating glass header */}
        <header className="sticky top-0 z-20 px-3 sm:px-5 lg:px-6 pt-3 lg:pt-4">
          <div
            className="
              mx-auto flex h-14 w-full items-center gap-2 rounded-full px-2
              bg-white/75 backdrop-blur-2xl ring-1 ring-ink-900/5
              shadow-[0_12px_40px_-20px_rgba(5,7,11,0.15)]
            "
          >
            <button
              onClick={() => setSidebarOpen(true)}
              className="
                flex h-10 w-10 items-center justify-center rounded-full
                text-ink-500 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]
                hover:bg-ink-900/[0.04] hover:text-ink-900 lg:hidden
                active:scale-[0.96]
              "
              aria-label="Open sidebar"
            >
              <Stroke d="M3 6h18 M3 12h18 M3 18h18" />
            </button>

            <div className="px-3 hidden sm:flex items-center gap-3">
              <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-400">
                {role === 'teacher' ? 'Educator' : role === 'admin' ? 'Administrator' : 'Learner'}
              </span>
              <span className="h-3 w-px bg-ink-900/10" />
              <span className="font-display text-[15px] font-semibold tracking-tightest text-ink-900">
                Dashboard
              </span>
            </div>

            <div className="ml-auto flex items-center gap-1.5 pr-1">
              {/* Notifications */}
              <div className="relative" ref={notifRef}>
                <button
                  onClick={() => setShowNotifications((s) => !s)}
                  className="
                    relative flex h-10 w-10 items-center justify-center rounded-full
                    text-ink-500 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]
                    hover:bg-ink-900/[0.04] hover:text-ink-900 active:scale-[0.96]
                  "
                  aria-label="Notifications"
                >
                  <Stroke d="M6 8a6 6 0 1 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9z M10 21a2 2 0 0 0 4 0" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white ring-2 ring-white">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                <div
                  className={`
                    absolute right-0 mt-3 w-[22rem] origin-top-right
                    rounded-3xl p-1.5 bg-ink-900/[0.04] ring-1 ring-ink-900/5
                    shadow-[0_30px_80px_-20px_rgba(5,7,11,0.25)]
                    transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]
                    ${
                      showNotifications
                        ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto'
                        : 'opacity-0 -translate-y-2 scale-[0.98] pointer-events-none'
                    }
                  `}
                >
                  <div className="rounded-[calc(1.5rem-0.375rem)] bg-white overflow-hidden">
                    <div className="flex items-center justify-between border-b border-ink-900/5 px-4 py-3">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-400">
                        Notifications
                      </span>
                      {unreadCount > 0 && (
                        <button
                          onClick={markAllAsRead}
                          className="text-[11px] font-medium text-primary-700 hover:text-primary-900 transition-colors"
                        >
                          Mark all read
                        </button>
                      )}
                    </div>
                    <div className="overflow-y-auto max-h-80">
                      {notifications.length === 0 ? (
                        <div className="py-12 text-center">
                          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-ink-50 text-ink-300">
                            <Stroke d="M6 8a6 6 0 1 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9z M10 21a2 2 0 0 0 4 0" />
                          </div>
                          <p className="text-sm text-ink-500">No notifications yet</p>
                        </div>
                      ) : (
                        notifications.slice(0, 10).map((notif) => (
                          <button
                            key={notif.id}
                            onClick={() => !notif.is_read && markAsRead(notif.id)}
                            className={`block w-full text-left px-4 py-3 border-b border-ink-900/5 last:border-0 transition-colors duration-300 hover:bg-ink-50/60 ${
                              !notif.is_read ? 'bg-primary-50/40' : ''
                            }`}
                          >
                            <div className="flex items-start gap-2.5">
                              {!notif.is_read && (
                                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary-500 shadow-[0_0_6px_rgba(16,185,129,0.7)]" />
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-ink-900">{notif.title}</p>
                                <p className="mt-0.5 text-xs text-ink-500 line-clamp-2">{notif.message}</p>
                                {notif.quiz_code && (
                                  <p className="mt-1 inline-flex rounded-md bg-primary-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-primary-700 ring-1 ring-primary-100">
                                    {notif.quiz_code}
                                  </p>
                                )}
                                <p className="mt-1 text-[10px] uppercase tracking-wider text-ink-400">
                                  {new Date(notif.created_at).toLocaleString()}
                                </p>
                              </div>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                    {role === 'student' && (
                      <Link
                        to="/dashboard/student/join-quiz"
                        onClick={() => setShowNotifications(false)}
                        className="block border-t border-ink-900/5 px-4 py-3 text-center text-sm font-medium text-primary-700 hover:bg-ink-50/60 transition-colors"
                      >
                        Join a Quiz →
                      </Link>
                    )}
                  </div>
                </div>
              </div>

              {/* User menu */}
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setShowUserMenu((s) => !s)}
                  className="
                    group flex items-center gap-2 rounded-full p-1 pr-3
                    ring-1 ring-ink-900/5 bg-ink-900/[0.03]
                    transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]
                    hover:bg-ink-900/[0.06] active:scale-[0.98]
                  "
                >
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-full font-display text-sm text-white"
                    style={{
                      background: 'linear-gradient(135deg, #047857 0%, #10B981 50%, #06B6D4 100%)',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18)',
                    }}
                  >
                    {user?.name?.charAt(0).toUpperCase() || 'U'}
                  </span>
                  <span className="hidden md:block text-sm font-medium text-ink-800">{user?.name}</span>
                  <Stroke d="M6 9l6 6 6-6" size={13} />
                </button>

                <div
                  className={`
                    absolute right-0 mt-3 w-60 origin-top-right
                    rounded-2xl bg-white p-1.5 ring-1 ring-ink-900/5
                    shadow-[0_24px_60px_-20px_rgba(5,7,11,0.2)]
                    transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]
                    ${
                      showUserMenu
                        ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto'
                        : 'opacity-0 -translate-y-2 scale-[0.98] pointer-events-none'
                    }
                  `}
                >
                  <div className="border-b border-ink-900/5 px-3 py-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-400">
                      Signed in as
                    </p>
                    <p className="mt-1 truncate text-sm font-semibold text-ink-900">
                      {user?.email ?? user?.name}
                    </p>
                  </div>
                  <Link
                    to="/profile"
                    onClick={() => setShowUserMenu(false)}
                    className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-ink-700 transition-colors duration-300 hover:bg-ink-50"
                  >
                    <Stroke d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" size={15} />
                    Your profile
                  </Link>
                  <Link
                    to="/settings"
                    onClick={() => setShowUserMenu(false)}
                    className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-ink-700 transition-colors duration-300 hover:bg-ink-50"
                  >
                    <Stroke d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.2a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.2a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" size={15} />
                    Settings
                  </Link>
                  <button
                    onClick={handleSignOut}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm text-rose-600 transition-colors duration-300 hover:bg-rose-50"
                  >
                    <Stroke d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3 M10 17l-5-5 5-5 M5 12h12" size={15} />
                    Sign out
                  </button>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8 relative">
          <Outlet />
        </main>
      </div>

      <ChatbotWidget />
    </div>
  );
};

export default DashboardLayout;

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../../store/authStore';
import { StatCard } from '../../../components/shared';
import api from '../../../services/api';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface Notification {
  id: string;
  title: string;
  message: string;
  quiz_code: string;
  is_read: boolean;
  created_at: string;
}

interface StudentAnalytics {
  totalQuizzes: number;
  avgScore: number;
  passRate: number;
  streakDays: number;
  performanceData: { week: string; score: number }[];
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

const StudentOverview = () => {
  const { user } = useAuthStore();
  const [analytics, setAnalytics] = useState<StudentAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);

  useEffect(() => {
    fetchAnalytics();
    fetchNotifications();
    const pollInterval = setInterval(() => {
      fetchNotifications();
    }, 10000);
    return () => clearInterval(pollInterval);
  }, []);

  const fetchAnalytics = async () => {
    setAnalyticsLoading(true);
    try {
      const response = await api.get('/quizzes/student/analytics');
      setAnalytics(response.data.data);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
      setAnalytics({ totalQuizzes: 0, avgScore: 0, passRate: 0, streakDays: 0, performanceData: [] });
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const fetchNotifications = async () => {
    setNotifLoading(true);
    try {
      const response = await api.get('/notifications');
      setNotifications(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      setNotifications([]);
    } finally {
      setNotifLoading(false);
    }
  };

  if (analyticsLoading) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <div className="relative h-12 w-12">
          <span className="absolute inset-0 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      {/* HERO */}
      <section className="relative overflow-hidden rounded-[2rem] p-1.5 bg-ink-900/[0.04] ring-1 ring-ink-900/5">
        <div
          className="
            relative overflow-hidden rounded-[calc(2rem-0.375rem)] bg-ink-950
            px-6 py-8 sm:px-10 sm:py-10
            shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]
          "
          style={{
            backgroundImage:
              'radial-gradient(60% 80% at 100% 0%, rgba(16,185,129,0.18) 0%, transparent 55%), radial-gradient(50% 60% at 0% 100%, rgba(124,58,237,0.10) 0%, transparent 55%)',
          }}
        >
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/5 ring-1 ring-white/10 px-3 py-1">
                <span className="h-1.5 w-1.5 rounded-full bg-primary-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/70">
                  Learner Console
                </span>
              </div>
              <h1 className="mt-4 font-display text-[36px] sm:text-[44px] leading-[1.05] tracking-tightest text-white">
                Welcome back,{' '}
                <span className="bg-gradient-to-r from-primary-300 via-primary-200 to-accent-300 bg-clip-text text-transparent">
                  {user?.name}
                </span>
              </h1>
              <p className="mt-3 max-w-xl text-[14.5px] leading-relaxed text-white/60">
                Ready to take a quiz? Enter the code shared by your teacher to begin.
              </p>

              <div className="mt-5 flex items-center gap-4">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] ring-1 ring-white/10 px-3 py-1.5">
                  <span className="text-amber-300">
                    <Stroke d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" size={14} />
                  </span>
                  <span className="text-[12px] font-medium text-white">{analytics?.streakDays || 0} day streak</span>
                </div>
                <span className="h-3 w-px bg-white/15" />
                <span className="text-[12px] text-white/60">
                  {analytics?.totalQuizzes || 0} quizzes completed
                </span>
              </div>
            </div>

            <Link
              to="/dashboard/student/join-quiz"
              className="
                group inline-flex items-center gap-2 rounded-full
                bg-white pl-5 pr-1.5 py-1.5
                text-[13px] font-semibold text-ink-900
                transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]
                hover:bg-primary-50 active:scale-[0.98]
                shadow-[0_8px_30px_-10px_rgba(16,185,129,0.6)]
              "
            >
              Join Quiz
              <span
                className="
                  flex h-8 w-8 items-center justify-center rounded-full
                  bg-ink-900/5 ring-1 ring-ink-900/5
                  transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]
                  group-hover:translate-x-0.5 group-hover:-translate-y-[1px] group-hover:bg-primary-100
                "
              >
                <Stroke d="M5 12h14 M12 5l7 7-7 7" size={13} />
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          icon={<Stroke d="M9 11l3 3 7-7 M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h10" />}
          label="Quizzes Completed"
          value={analytics?.totalQuizzes || 0}
          color="primary"
        />
        <StatCard
          icon={<Stroke d="M3 21h18 M6 17V9 M11 17V5 M16 17v-7 M21 17v-3" />}
          label="Average Score"
          value={analytics?.avgScore ? `${analytics.avgScore}%` : 'N/A'}
          color="blue"
          trend={analytics?.avgScore && analytics.avgScore >= 60 ? 'up' : 'down'}
        />
        <StatCard
          icon={<Stroke d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />}
          label="Learning Streak"
          value={`${analytics?.streakDays || 0} Days`}
          color="orange"
        />
      </section>

      {/* Performance + Notifications */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Performance */}
        <div className="lg:col-span-2 rounded-[1.5rem] p-1.5 bg-ink-900/[0.03] ring-1 ring-ink-900/5">
          <div className="rounded-[calc(1.5rem-0.375rem)] bg-white p-6 sm:p-7 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
            <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-400">
              Trajectory
            </span>
            <h3 className="mt-1 font-display text-[20px] tracking-tightest text-ink-900">
              Performance Trend
            </h3>
            {analytics?.performanceData && analytics.performanceData.length > 0 ? (
              <div className="h-64 mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analytics.performanceData}>
                    <defs>
                      <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#10B981" />
                        <stop offset="100%" stopColor="#06B6D4" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#EFF1F3" />
                    <XAxis dataKey="week" stroke="#7E8896" fontSize={11} />
                    <YAxis stroke="#7E8896" fontSize={11} domain={[0, 100]} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#fff',
                        border: '1px solid rgba(15,23,42,0.06)',
                        borderRadius: '14px',
                        boxShadow: '0 24px 60px -20px rgba(15,23,42,0.18)',
                        fontSize: 12,
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke="url(#lineGrad)"
                      strokeWidth={2.5}
                      dot={{ fill: '#10B981', strokeWidth: 0, r: 4 }}
                      activeDot={{ r: 7, fill: '#10B981', stroke: '#fff', strokeWidth: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 mt-4 flex items-center justify-center">
                <div className="text-center">
                  <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-ink-50 ring-1 ring-ink-900/5 text-ink-400">
                    <Stroke d="M3 21h18 M6 17V9 M11 17V5 M16 17v-7 M21 17v-3" />
                  </div>
                  <p className="text-[13px] text-ink-500">Complete quizzes to see your performance trend</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Notifications */}
        <div className="rounded-[1.5rem] p-1.5 bg-ink-900/[0.03] ring-1 ring-ink-900/5">
          <div className="rounded-[calc(1.5rem-0.375rem)] bg-white p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-400">
                  Inbox
                </span>
                <h3 className="mt-1 font-display text-[20px] tracking-tightest text-ink-900">
                  Notifications
                </h3>
              </div>
              <span className="inline-flex items-center justify-center h-7 min-w-[28px] px-2 rounded-full bg-primary-50 text-[11px] font-semibold text-primary-700 ring-1 ring-primary-100">
                {notifications.filter((n) => !n.is_read).length}
              </span>
            </div>

            {notifLoading ? (
              <div className="mt-4 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-3 bg-ink-100 rounded w-3/4 mb-2"></div>
                    <div className="h-2.5 bg-ink-100/70 rounded w-full"></div>
                  </div>
                ))}
              </div>
            ) : notifications.length > 0 ? (
              <ul className="mt-4 space-y-2 max-h-72 overflow-y-auto pr-1">
                {notifications.slice(0, 5).map((notif) => (
                  <li
                    key={notif.id}
                    className={`
                      relative rounded-2xl px-4 py-3 transition-colors duration-500
                      ${notif.is_read ? 'bg-ink-50/60 ring-1 ring-ink-900/[0.04]' : 'bg-primary-50/60 ring-1 ring-primary-100'}
                    `}
                  >
                    {!notif.is_read && (
                      <span className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full bg-gradient-to-b from-primary-400 to-accent-400" />
                    )}
                    <p className="text-[13px] font-semibold text-ink-900">{notif.title}</p>
                    <p className="mt-0.5 text-[12px] text-ink-500 line-clamp-2">{notif.message}</p>
                    {notif.quiz_code && (
                      <p className="mt-2 inline-flex rounded-md bg-white px-2 py-0.5 font-mono text-[11px] font-bold text-primary-700 ring-1 ring-primary-100">
                        {notif.quiz_code}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-[13px] text-ink-500">
                No notifications yet. Your teacher will notify you when a new quiz is available.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Quick Actions */}
      <section className="rounded-[1.5rem] p-1.5 bg-ink-900/[0.03] ring-1 ring-ink-900/5">
        <div className="rounded-[calc(1.5rem-0.375rem)] bg-white p-6 sm:p-7 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
          <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-400">
            Shortcuts
          </span>
          <h3 className="mt-1 font-display text-[20px] tracking-tightest text-ink-900">Quick Actions</h3>

          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
            {[
              {
                to: '/dashboard/student/join-quiz',
                title: 'Join Quiz',
                desc: 'Enter a code to take a quiz',
                d: 'M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h2v2h-2z M18 14h2v2h-2z M14 18h2v2h-2z M18 18h2v2h-2z',
              },
              {
                to: '/dashboard/student/quiz-history',
                title: 'Quiz History',
                desc: 'Review your past attempts',
                d: 'M3 12a9 9 0 1 0 3-6.7 M3 4v5h5 M12 8v4l3 2',
              },
              {
                to: '/dashboard/student/courses',
                title: 'My Courses',
                desc: 'Browse enrolled courses',
                d: 'M4 5a2 2 0 0 1 2-2h11v17H6a2 2 0 0 1-2-2V5z M9 3v17 M17 7H9 M17 11H9',
              },
              {
                to: '/analytics',
                title: 'My Analytics',
                desc: 'Detailed performance insights',
                d: 'M3 21h18 M6 17V9 M11 17V5 M16 17v-7 M21 17v-3',
              },
            ].map((a) => (
              <Link
                key={a.to}
                to={a.to}
                className="
                  group flex items-center gap-4 rounded-2xl
                  bg-ink-50/60 ring-1 ring-ink-900/[0.04] px-4 py-3.5
                  transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]
                  hover:bg-white hover:ring-primary-200 hover:shadow-[0_24px_60px_-30px_rgba(16,185,129,0.4)]
                  active:scale-[0.99]
                "
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white ring-1 ring-ink-900/5 text-primary-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                  <Stroke d={a.d} size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold text-ink-900">{a.title}</p>
                  <p className="text-[12px] text-ink-500">{a.desc}</p>
                </div>
                <span
                  className="
                    flex h-8 w-8 items-center justify-center rounded-full
                    bg-ink-900/[0.04] ring-1 ring-ink-900/5 text-ink-500
                    transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]
                    group-hover:translate-x-0.5 group-hover:-translate-y-[1px]
                    group-hover:bg-primary-50 group-hover:text-primary-700 group-hover:ring-primary-200
                  "
                >
                  <Stroke d="M5 12h14 M12 5l7 7-7 7" size={12} />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default StudentOverview;

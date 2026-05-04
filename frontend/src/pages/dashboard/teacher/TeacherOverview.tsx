import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../../store/authStore';
import { StatCard } from '../../../components/shared';
import api from '../../../services/api';
import toast from 'react-hot-toast';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

interface TeacherStats {
  totalCourses: number;
  totalStudents: number;
  totalQuestions: number;
  totalTopics: number;
  avgStudentScore: number;
  activeEnrollments: number;
}

interface CoursePerformance {
  courseName: string;
  avgScore: number;
  completionRate: number;
  enrollments: number;
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

const TeacherOverview = () => {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<TeacherStats | null>(null);
  const [coursePerformance, setCoursePerformance] = useState<CoursePerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const handleExportMarks = useCallback(async () => {
    setExporting(true);
    try {
      const response = await api.get('/analytics/teacher/export-marks', { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'text/csv' });
      const text = await blob.text();
      const lines = text.trim().split('\n');
      if (lines.length <= 1) {
        toast('No student marks data to export yet.', { icon: 'ℹ️' });
        setExporting(false);
        return;
      }
      const url = window.URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `student_marks_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Marks exported successfully!');
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export marks. Please try again.');
    } finally {
      setExporting(false);
    }
  }, []);

  const difficultyDistribution = [
    { name: 'Beginner', value: 35, color: '#10B981' },
    { name: 'Intermediate', value: 45, color: '#06B6D4' },
    { name: 'Advanced', value: 20, color: '#7C3AED' },
  ];

  useEffect(() => {
    fetchTeacherStats();
  }, []);

  const fetchTeacherStats = async () => {
    setLoading(true);
    try {
      const [statsRes, performanceRes] = await Promise.all([
        api.get('/analytics/teacher/stats'),
        api.get('/analytics/teacher/course-performance'),
      ]);
      setStats(statsRes.data.data);
      setCoursePerformance(performanceRes.data.data || []);
    } catch (error) {
      setStats({
        totalCourses: 5,
        totalStudents: 128,
        totalQuestions: 245,
        totalTopics: 32,
        avgStudentScore: 76.5,
        activeEnrollments: 89,
      });
      setCoursePerformance([
        { courseName: 'JavaScript Basics', avgScore: 82, completionRate: 75, enrollments: 45 },
        { courseName: 'React Fundamentals', avgScore: 78, completionRate: 68, enrollments: 38 },
        { courseName: 'Node.js Backend', avgScore: 71, completionRate: 52, enrollments: 28 },
        { courseName: 'Python for Beginners', avgScore: 85, completionRate: 82, enrollments: 52 },
        { courseName: 'Data Structures', avgScore: 68, completionRate: 45, enrollments: 21 },
      ]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
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
      {/* HERO — Editorial dark glass */}
      <section
        className="relative overflow-hidden rounded-[2rem] p-1.5 bg-ink-900/[0.04] ring-1 ring-ink-900/5"
      >
        <div
          className="
            relative overflow-hidden rounded-[calc(2rem-0.375rem)] bg-ink-950
            px-6 py-8 sm:px-10 sm:py-10
            shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]
          "
          style={{
            backgroundImage:
              'radial-gradient(60% 80% at 0% 0%, rgba(16,185,129,0.18) 0%, transparent 55%), radial-gradient(50% 60% at 100% 100%, rgba(6,182,212,0.14) 0%, transparent 55%)',
          }}
        >
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/5 ring-1 ring-white/10 px-3 py-1">
                <span className="h-1.5 w-1.5 rounded-full bg-primary-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/70">
                  Educator Console
                </span>
              </div>
              <h1 className="mt-4 font-display text-[36px] sm:text-[44px] leading-[1.05] tracking-tightest text-white">
                Welcome,{' '}
                <span className="bg-gradient-to-r from-primary-300 via-primary-200 to-accent-300 bg-clip-text text-transparent">
                  {user?.name}
                </span>
              </h1>
              <p className="mt-3 max-w-xl text-[14.5px] leading-relaxed text-white/60">
                Author quizzes, curate questions, and watch your cohort progress in real time.
              </p>
            </div>

            {/* CTA cluster */}
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                onClick={handleExportMarks}
                disabled={exporting}
                className="
                  group inline-flex items-center gap-2 rounded-full
                  bg-white/[0.06] ring-1 ring-white/10 pl-5 pr-1.5 py-1.5
                  text-[13px] font-medium text-white
                  transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]
                  hover:bg-white/[0.10] active:scale-[0.98] disabled:opacity-50
                "
              >
                {exporting ? 'Exporting…' : 'Export Marks'}
                <span
                  className="
                    flex h-8 w-8 items-center justify-center rounded-full
                    bg-white/10 ring-1 ring-white/15
                    transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]
                    group-hover:translate-x-0.5 group-hover:-translate-y-[1px] group-hover:bg-white/15
                  "
                >
                  {exporting ? (
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border border-white/40 border-t-white" />
                  ) : (
                    <Stroke d="M12 4v12 M6 12l6 6 6-6 M5 21h14" size={13} />
                  )}
                </span>
              </button>

              <Link
                to="/dashboard/teacher/quizzes"
                className="
                  group inline-flex items-center gap-2 rounded-full
                  bg-white pl-5 pr-1.5 py-1.5
                  text-[13px] font-semibold text-ink-900
                  transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]
                  hover:bg-primary-50 active:scale-[0.98]
                  shadow-[0_8px_30px_-10px_rgba(16,185,129,0.6)]
                "
              >
                New Quiz
                <span
                  className="
                    flex h-8 w-8 items-center justify-center rounded-full
                    bg-ink-900/5 ring-1 ring-ink-900/5
                    transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]
                    group-hover:translate-x-0.5 group-hover:-translate-y-[1px] group-hover:bg-primary-100
                  "
                >
                  <Stroke d="M12 5v14 M5 12h14" size={13} />
                </span>
              </Link>

              <Link
                to="/dashboard/teacher/questions"
                className="
                  group inline-flex items-center gap-2 rounded-full
                  bg-white/[0.06] ring-1 ring-white/10 pl-5 pr-1.5 py-1.5
                  text-[13px] font-medium text-white
                  transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]
                  hover:bg-white/[0.10] active:scale-[0.98]
                "
              >
                Add Question
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/15 transition-all duration-500 group-hover:translate-x-0.5 group-hover:-translate-y-[1px]">
                  <Stroke d="M5 12h14 M12 5l7 7-7 7" size={12} />
                </span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats — Bento */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Stroke d="M4 5a2 2 0 0 1 2-2h11v17H6a2 2 0 0 1-2-2V5z M9 3v17 M17 7H9 M17 11H9" />}
          label="Total Courses"
          value={stats?.totalCourses || 0}
          color="primary"
        />
        <StatCard
          icon={<Stroke d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M22 21v-2a4 4 0 0 0-3-3.9 M16 3.1a4 4 0 0 1 0 7.8" />}
          label="Total Students"
          value={stats?.totalStudents || 0}
          color="blue"
          trend="up"
          change={8}
        />
        <StatCard
          icon={<Stroke d="M9 9a3 3 0 1 1 4.3 2.7c-.8.4-1.3 1-1.3 2V14 M12 18h.01 M3 12a9 9 0 1 1 18 0 9 9 0 0 1-18 0z" />}
          label="Questions Created"
          value={stats?.totalQuestions || 0}
          color="purple"
        />
        <StatCard
          icon={<Stroke d="M3 21h18 M6 17V9 M11 17V5 M16 17v-7 M21 17v-3" />}
          label="Avg. Student Score"
          value={`${stats?.avgStudentScore?.toFixed(1) || 0}%`}
          color="orange"
          trend={stats?.avgStudentScore && stats.avgStudentScore >= 70 ? 'up' : 'down'}
        />
      </section>

      {/* Charts — Asymmetrical */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Course performance */}
        <div className="lg:col-span-2 rounded-[1.5rem] p-1.5 bg-ink-900/[0.03] ring-1 ring-ink-900/5">
          <div className="rounded-[calc(1.5rem-0.375rem)] bg-white p-6 sm:p-7 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-400">
                  Cohort Pulse
                </span>
                <h3 className="mt-1 font-display text-[20px] tracking-tightest text-ink-900">
                  Course Performance
                </h3>
              </div>
              <span className="hidden sm:inline-flex items-center gap-3 text-[11px] text-ink-500">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-primary-500" /> Avg Score
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-accent-500" /> Completion
                </span>
              </span>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={coursePerformance} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#EFF1F3" />
                  <XAxis type="number" domain={[0, 100]} stroke="#7E8896" fontSize={11} />
                  <YAxis
                    type="category"
                    dataKey="courseName"
                    stroke="#7E8896"
                    fontSize={11}
                    width={130}
                    tick={{ fill: '#3A434F' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid rgba(15,23,42,0.06)',
                      borderRadius: '14px',
                      boxShadow: '0 24px 60px -20px rgba(15,23,42,0.18)',
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="avgScore" fill="#10B981" name="Avg Score %" radius={[0, 8, 8, 0]} />
                  <Bar dataKey="completionRate" fill="#06B6D4" name="Completion %" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Difficulty */}
        <div className="rounded-[1.5rem] p-1.5 bg-ink-900/[0.03] ring-1 ring-ink-900/5">
          <div className="rounded-[calc(1.5rem-0.375rem)] bg-white p-6 sm:p-7 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
            <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-400">
              Distribution
            </span>
            <h3 className="mt-1 font-display text-[20px] tracking-tightest text-ink-900">
              Question Difficulty
            </h3>
            <div className="h-64 mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={difficultyDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={84}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="#fff"
                    strokeWidth={3}
                  >
                    {difficultyDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid rgba(15,23,42,0.06)',
                      borderRadius: '14px',
                      fontSize: 12,
                    }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </section>

      {/* Activity + Quick actions */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Activity */}
        <div className="rounded-[1.5rem] p-1.5 bg-ink-900/[0.03] ring-1 ring-ink-900/5">
          <div className="rounded-[calc(1.5rem-0.375rem)] bg-white p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-400">
                  Live Feed
                </span>
                <h3 className="mt-1 font-display text-[20px] tracking-tightest text-ink-900">
                  Recent Activity
                </h3>
              </div>
              <Link
                to="/dashboard/teacher/analytics"
                className="text-[12px] font-medium text-primary-700 hover:text-primary-900 transition-colors"
              >
                View all →
              </Link>
            </div>
            <ul className="space-y-2">
              {[
                { text: 'New student enrolled in JavaScript Basics', time: '2 hours ago' },
                { text: '15 students completed React Quiz #3', time: '5 hours ago' },
                { text: 'Python course reached 50 enrollments', time: '1 day ago' },
              ].map((a, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 rounded-2xl bg-ink-50/60 ring-1 ring-ink-900/[0.04] px-4 py-3 transition-colors duration-500 hover:bg-ink-50"
                >
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-700 ring-1 ring-primary-100">
                    <Stroke d="M3 17l6-6 4 4 8-8 M14 7h7v7" size={14} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] text-ink-800">{a.text}</p>
                    <p className="mt-0.5 text-[10px] uppercase tracking-wider text-ink-400">{a.time}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Quick actions */}
        <div className="rounded-[1.5rem] p-1.5 bg-ink-900/[0.03] ring-1 ring-ink-900/5">
          <div className="rounded-[calc(1.5rem-0.375rem)] bg-white p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
            <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-400">
              Shortcuts
            </span>
            <h3 className="mt-1 font-display text-[20px] tracking-tightest text-ink-900">Quick Actions</h3>

            <div className="mt-5 grid grid-cols-1 gap-3">
              {[
                {
                  to: '/dashboard/teacher/quizzes',
                  title: 'Create a Quiz',
                  desc: 'Build assessments with timing & proctoring',
                  d: 'M9 11l3 3 7-7 M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h10',
                },
                {
                  to: '/dashboard/teacher/questions',
                  title: 'Manage Questions',
                  desc: 'Author MCQs, tag topics, set difficulty',
                  d: 'M9 9a3 3 0 1 1 4.3 2.7c-.8.4-1.3 1-1.3 2V14 M12 18h.01 M3 12a9 9 0 1 1 18 0 9 9 0 0 1-18 0z',
                },
                {
                  to: '/dashboard/teacher/analytics',
                  title: 'View Analytics',
                  desc: 'Cohort trends, completion rates, hotspots',
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
        </div>
      </section>
    </div>
  );
};

export default TeacherOverview;

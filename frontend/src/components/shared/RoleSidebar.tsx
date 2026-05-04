import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import Brand from './Brand';
import { useAuthStore } from '../../store/authStore';

export interface SidebarItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

interface RoleSidebarProps {
  items: SidebarItem[];
  isOpen: boolean;
  onClose: () => void;
  role: 'student' | 'teacher' | 'admin';
}

const Stroke = ({ d, size = 18 }: { d: string; size?: number }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.3"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d={d} />
  </svg>
);

const roleAccent: Record<string, string> = {
  student: 'Learner',
  teacher: 'Educator',
  admin: 'Administrator',
};

const RoleSidebar: React.FC<RoleSidebarProps> = ({ items, isOpen, onClose, role }) => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleSignOut = () => {
    logout();
    navigate('/login');
  };

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className={`
          fixed inset-0 z-20 bg-ink-950/60 backdrop-blur-sm transition-opacity duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] lg:hidden
          ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}
        `}
        onClick={onClose}
      />

      {/* Sidebar — outer shell (Doppelrand) */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-30 flex w-72 p-3
          transition-transform duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]
          lg:translate-x-0 lg:static lg:inset-auto
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Inner core — vantablack glass panel */}
        <div
          className="
            relative flex flex-col w-full overflow-hidden
            rounded-[2rem] bg-ink-950
            ring-1 ring-white/10
            shadow-[0_30px_80px_-30px_rgba(5,7,11,0.6),inset_0_1px_0_rgba(255,255,255,0.06)]
          "
          style={{
            backgroundImage:
              'radial-gradient(120% 70% at 0% 0%, rgba(16,185,129,0.10) 0%, transparent 55%), radial-gradient(80% 60% at 100% 100%, rgba(6,182,212,0.06) 0%, transparent 55%)',
          }}
        >
          {/* Mobile close */}
          <div className="flex items-center justify-between px-5 pt-5 lg:hidden">
            <Brand to="/" variant="dark" />
            <button
              onClick={onClose}
              className="
                flex h-9 w-9 items-center justify-center rounded-full
                text-white/60 ring-1 ring-white/10 bg-white/[0.04]
                transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]
                hover:bg-white/[0.08] hover:text-white active:scale-[0.96]
              "
              aria-label="Close sidebar"
            >
              <Stroke d="M6 6l12 12 M18 6l-12 12" size={16} />
            </button>
          </div>

          {/* Brand (desktop) */}
          <div className="hidden lg:flex items-center px-6 pt-7 pb-5">
            <Brand to="/" variant="dark" />
          </div>

          {/* Eyebrow role badge */}
          <div className="px-6 pb-5">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/[0.04] ring-1 ring-white/10 px-3 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-primary-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/70">
                {roleAccent[role]}
              </span>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto px-3 space-y-1.5">
            {items.map((item) => (
              <NavLink
                key={item.label}
                to={item.href}
                onClick={() => {
                  if (window.innerWidth < 1024) onClose();
                }}
                end={item.href.split('/').length <= 3}
                className={({ isActive }) =>
                  `
                  group relative flex items-center gap-3 rounded-2xl px-3 py-2.5
                  text-[13.5px] font-medium tracking-tight
                  transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]
                  ${
                    isActive
                      ? 'bg-white/[0.08] text-white ring-1 ring-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                      : 'text-white/60 hover:text-white hover:bg-white/[0.04]'
                  }
                  active:scale-[0.985]
                `
                }
              >
                {({ isActive }) => (
                  <>
                    {/* Active rail */}
                    <span
                      aria-hidden
                      className={`
                        absolute left-0 top-1/2 -translate-y-1/2 h-6 w-[3px] rounded-r-full
                        bg-gradient-to-b from-primary-300 via-primary-400 to-accent-400
                        transition-opacity duration-500
                        ${isActive ? 'opacity-100' : 'opacity-0'}
                      `}
                    />
                    {/* Icon enclosure */}
                    <span
                      className={`
                        flex h-8 w-8 shrink-0 items-center justify-center rounded-xl
                        ring-1 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]
                        ${
                          isActive
                            ? 'bg-primary-500/15 ring-primary-400/30 text-primary-300'
                            : 'bg-white/[0.03] ring-white/5 text-white/55 group-hover:text-white/85 group-hover:ring-white/10'
                        }
                      `}
                    >
                      {item.icon}
                    </span>
                    <span className="flex-1">{item.label}</span>
                    <span
                      aria-hidden
                      className={`
                        opacity-0 -translate-x-1
                        transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]
                        ${isActive ? 'opacity-100 translate-x-0' : 'group-hover:opacity-60 group-hover:translate-x-0'}
                      `}
                    >
                      <Stroke d="M9 6l6 6-6 6" size={14} />
                    </span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          {/* Bottom: user card + sign out */}
          <div className="px-3 pb-3 pt-4 mt-auto">
            <div
              className="
                rounded-2xl p-1.5 bg-white/[0.04] ring-1 ring-white/10
                shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]
              "
            >
              <div className="flex items-center gap-3 rounded-[calc(1rem-0.375rem)] bg-ink-900/60 px-3 py-2.5">
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-display text-sm text-white"
                  style={{
                    background:
                      'linear-gradient(135deg, #022C1F 0%, #047857 50%, #06B6D4 100%)',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18)',
                  }}
                >
                  {user?.name?.charAt(0).toUpperCase() || 'U'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-white">
                    {user?.name}
                  </p>
                  <p className="truncate text-[11px] text-white/50">
                    {user?.email}
                  </p>
                </div>
              </div>

              <button
                onClick={handleSignOut}
                className="
                  group mt-1.5 flex w-full items-center justify-between gap-2
                  rounded-[calc(1rem-0.375rem)] px-3 py-2.5
                  text-[13px] font-medium text-white/70
                  transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]
                  hover:text-rose-200 hover:bg-rose-500/10 active:scale-[0.985]
                "
              >
                <span className="inline-flex items-center gap-2.5">
                  <Stroke d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3 M10 17l-5-5 5-5 M5 12h12" size={15} />
                  Sign out
                </span>
                <span
                  className="
                    flex h-7 w-7 items-center justify-center rounded-full
                    bg-white/[0.04] ring-1 ring-white/10
                    transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]
                    group-hover:bg-rose-500/15 group-hover:ring-rose-300/30
                    group-hover:translate-x-0.5 group-hover:-translate-y-[1px]
                  "
                >
                  <Stroke d="M7 17 17 7 M9 7h8v8" size={11} />
                </span>
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default RoleSidebar;

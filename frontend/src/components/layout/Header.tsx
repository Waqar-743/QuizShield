import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useEffect, useRef, useState } from 'react';
import { Brand } from '../shared';

interface HeaderProps {
  toggleSidebar: () => void;
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

const Header = ({ toggleSidebar }: HeaderProps) => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-30 px-3 sm:px-4 pt-3">
      <div
        className="
          mx-auto flex h-14 w-full items-center gap-2 rounded-full px-2
          bg-white/75 backdrop-blur-2xl ring-1 ring-ink-900/5
          shadow-[0_12px_40px_-20px_rgba(5,7,11,0.18)]
        "
      >
        <button
          onClick={toggleSidebar}
          className="
            flex h-10 w-10 items-center justify-center rounded-full
            text-ink-500 transition-all duration-500 ease-spring
            hover:bg-ink-900/[0.04] hover:text-ink-900 lg:hidden
          "
          aria-label="Open sidebar"
        >
          <Stroke d="M3 6h18 M3 12h18 M3 18h18" />
        </button>

        <div className="px-2">
          <Brand to="/" />
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <button
            className="
              hidden sm:flex h-10 w-10 items-center justify-center rounded-full
              text-ink-500 transition-all duration-500 ease-spring
              hover:bg-ink-900/[0.04] hover:text-ink-900
            "
            aria-label="Notifications"
          >
            <Stroke d="M6 8a6 6 0 1 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9z M10 21a2 2 0 0 0 4 0" />
          </button>

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setIsProfileOpen((o) => !o)}
              className="
                group flex items-center gap-2 rounded-full p-1 pr-3
                ring-1 ring-ink-900/5 bg-ink-900/[0.03]
                transition-all duration-500 ease-spring hover:bg-ink-900/[0.06]
              "
            >
              <span
                className="
                  flex h-8 w-8 items-center justify-center rounded-full
                  font-display text-sm text-white
                "
                style={{
                  background:
                    'linear-gradient(135deg, #047857 0%, #10B981 50%, #06B6D4 100%)',
                }}
              >
                {user?.name?.charAt(0).toUpperCase() || 'U'}
              </span>
              <span className="hidden md:block text-sm font-medium text-ink-800">
                {user?.name}
              </span>
              <Stroke d="M6 9l6 6 6-6" size={14} />
            </button>

            <div
              className={`
                absolute right-0 mt-3 w-56 origin-top-right
                rounded-2xl bg-white p-1.5 ring-1 ring-ink-900/5
                shadow-[0_24px_60px_-20px_rgba(5,7,11,0.2)]
                transition-all duration-500 ease-spring
                ${
                  isProfileOpen
                    ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto'
                    : 'opacity-0 -translate-y-2 scale-[0.98] pointer-events-none'
                }
              `}
            >
              <div className="border-b border-ink-900/5 px-3 py-2.5">
                <p className="text-xs text-ink-400">Signed in as</p>
                <p className="truncate text-sm font-semibold text-ink-900">
                  {user?.email ?? user?.name}
                </p>
              </div>
              <Link
                to="/profile"
                onClick={() => setIsProfileOpen(false)}
                className="block rounded-xl px-3 py-2 text-sm text-ink-700 transition-colors duration-300 hover:bg-ink-50"
              >
                Your profile
              </Link>
              <Link
                to="/settings"
                onClick={() => setIsProfileOpen(false)}
                className="block rounded-xl px-3 py-2 text-sm text-ink-700 transition-colors duration-300 hover:bg-ink-50"
              >
                Settings
              </Link>
              <button
                onClick={handleLogout}
                className="block w-full rounded-xl px-3 py-2 text-left text-sm text-rose-600 transition-colors duration-300 hover:bg-rose-50"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;

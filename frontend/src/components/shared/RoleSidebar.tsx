import React from 'react';
import { NavLink } from 'react-router-dom';
import { XMarkIcon } from '@heroicons/react/24/outline';
import Brand from './Brand';

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

const roleColors = {
  student: {
    bg: 'bg-primary-600',
    hover: 'hover:bg-primary-700',
    active: 'bg-primary-700',
  },
  teacher: {
    bg: 'bg-indigo-600',
    hover: 'hover:bg-indigo-700',
    active: 'bg-indigo-700',
  },
  admin: {
    bg: 'bg-purple-600',
    hover: 'hover:bg-purple-700',
    active: 'bg-purple-700',
  },
};

const RoleSidebar: React.FC<RoleSidebarProps> = ({ items, isOpen, onClose, role }) => {
  const colors = roleColors[role];

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-gray-600 bg-opacity-75 z-20 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-30 w-64 ${colors.bg} transform transition-transform duration-300 ease-in-out
          lg:translate-x-0 lg:static lg:inset-auto lg:transform-none
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Mobile close button */}
        <div className="flex items-center justify-between p-4 lg:hidden">
          <Brand
            to="/"
            textClassName="text-white font-semibold text-lg"
            iconWrapperClassName="bg-white/10 ring-1 ring-white/20"
            iconClassName="h-5 w-5 text-white"
          />
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Logo */}
        <div className="hidden lg:flex items-center justify-center h-16 border-b border-white/10">
          <Brand
            to="/"
            textClassName="text-white font-bold text-xl"
            iconWrapperClassName="bg-white/10 ring-1 ring-white/20"
            iconClassName="h-5 w-5 text-white"
          />
        </div>

        {/* Role badge */}
        <div className="px-4 py-3 border-b border-white/10">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-white/20 text-white capitalize">
            {role} Dashboard
          </span>
        </div>

        {/* Navigation */}
        <nav className="mt-4 px-2 space-y-1">
          {items.map((item) => (
            <NavLink
              key={item.label}
              to={item.href}
              onClick={onClose}
              className={({ isActive }) =>
                `group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  isActive
                    ? `${colors.active} text-white`
                    : `text-white/80 ${colors.hover} hover:text-white`
                }`
              }
            >
              <span className="mr-3 flex-shrink-0">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
};

export default RoleSidebar;

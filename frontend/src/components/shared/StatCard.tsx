import React from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: 'up' | 'down';
  change?: number;
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'primary' | 'success' | 'warning' | 'danger' | 'info';
  isLoading?: boolean;
}

const tones: Record<string, { ring: string; bg: string; fg: string; glow: string }> = {
  primary: {
    ring: 'ring-primary-200/70',
    bg: 'bg-gradient-to-br from-primary-50 to-white',
    fg: 'text-primary-700',
    glow: 'rgba(16,185,129,0.18)',
  },
  green: {
    ring: 'ring-primary-200/70',
    bg: 'bg-gradient-to-br from-primary-50 to-white',
    fg: 'text-primary-700',
    glow: 'rgba(16,185,129,0.18)',
  },
  success: {
    ring: 'ring-primary-200/70',
    bg: 'bg-gradient-to-br from-primary-50 to-white',
    fg: 'text-primary-700',
    glow: 'rgba(16,185,129,0.18)',
  },
  blue: {
    ring: 'ring-accent-200/70',
    bg: 'bg-gradient-to-br from-accent-50 to-white',
    fg: 'text-accent-700',
    glow: 'rgba(6,182,212,0.18)',
  },
  info: {
    ring: 'ring-accent-200/70',
    bg: 'bg-gradient-to-br from-accent-50 to-white',
    fg: 'text-accent-700',
    glow: 'rgba(6,182,212,0.18)',
  },
  purple: {
    ring: 'ring-secondary-200/70',
    bg: 'bg-gradient-to-br from-secondary-50 to-white',
    fg: 'text-secondary-700',
    glow: 'rgba(124,58,237,0.18)',
  },
  orange: {
    ring: 'ring-amber-200/70',
    bg: 'bg-gradient-to-br from-amber-50 to-white',
    fg: 'text-amber-700',
    glow: 'rgba(245,158,11,0.20)',
  },
  warning: {
    ring: 'ring-amber-200/70',
    bg: 'bg-gradient-to-br from-amber-50 to-white',
    fg: 'text-amber-700',
    glow: 'rgba(245,158,11,0.20)',
  },
  red: {
    ring: 'ring-rose-200/70',
    bg: 'bg-gradient-to-br from-rose-50 to-white',
    fg: 'text-rose-700',
    glow: 'rgba(244,63,94,0.18)',
  },
  danger: {
    ring: 'ring-rose-200/70',
    bg: 'bg-gradient-to-br from-rose-50 to-white',
    fg: 'text-rose-700',
    glow: 'rgba(244,63,94,0.18)',
  },
};

const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  icon,
  trend,
  change,
  color = 'primary',
  isLoading = false,
}) => {
  const tone = tones[color] ?? tones.primary;

  if (isLoading) {
    return (
      <div className="rounded-[1.5rem] p-1.5 bg-ink-900/[0.03] ring-1 ring-ink-900/5">
        <div className="rounded-[calc(1.5rem-0.375rem)] bg-white p-6 animate-pulse">
          <div className="flex items-center justify-between">
            <div className="space-y-3 flex-1">
              <div className="h-3 bg-ink-100 rounded-full w-24"></div>
              <div className="h-7 bg-ink-100 rounded-md w-16"></div>
            </div>
            <div className="w-11 h-11 bg-ink-100 rounded-xl"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="
        group rounded-[1.5rem] p-1.5
        bg-ink-900/[0.03] ring-1 ring-ink-900/5
        transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]
        hover:bg-ink-900/[0.05]
      "
    >
      <div
        className="
          relative overflow-hidden rounded-[calc(1.5rem-0.375rem)] bg-white p-5
          shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.08)]
          transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]
          group-hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_2px_6px_rgba(15,23,42,0.06),0_24px_60px_-20px_rgba(15,23,42,0.18)]
        "
      >
        {/* Soft glow accent */}
        <span
          aria-hidden
          className="pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full opacity-60 blur-2xl transition-opacity duration-700"
          style={{ background: tone.glow }}
        />

        <div className="relative flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-400">
              {label}
            </p>
            <p className="mt-2 font-display text-[28px] leading-none tracking-tightest text-ink-900">
              {value}
            </p>
            {trend && change !== undefined && (
              <p
                className={`mt-2 inline-flex items-center gap-1 text-[11px] font-medium ${
                  trend === 'up' ? 'text-primary-700' : 'text-rose-600'
                }`}
              >
                <span
                  className={`inline-flex h-4 w-4 items-center justify-center rounded-full ${
                    trend === 'up' ? 'bg-primary-100' : 'bg-rose-100'
                  }`}
                >
                  {trend === 'up' ? '↑' : '↓'}
                </span>
                {Math.abs(change)}% from last week
              </p>
            )}
          </div>

          {/* Icon — Double-bezel enclosure */}
          <div className={`rounded-2xl p-1 ring-1 ${tone.ring} bg-white/60`}>
            <div
              className={`
                flex h-10 w-10 items-center justify-center rounded-xl
                ${tone.bg} ${tone.fg}
                shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]
              `}
            >
              {icon}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatCard;

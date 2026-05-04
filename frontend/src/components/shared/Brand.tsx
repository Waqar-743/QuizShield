import { Link } from 'react-router-dom';

type BrandProps = {
  to?: string;
  className?: string;
  /** Visual variant for the mark + wordmark. */
  variant?: 'light' | 'dark';
  /** Hides wordmark — useful for tight headers. */
  iconOnly?: boolean;
  /** Legacy hooks kept so old call sites don't break. */
  iconWrapperClassName?: string;
  iconClassName?: string;
  textClassName?: string;
};

const Brand = ({
  to,
  className = '',
  variant = 'light',
  iconOnly = false,
}: BrandProps) => {
  const isDark = variant === 'dark';

  const content = (
    <div className={`group inline-flex items-center gap-2.5 ${className}`.trim()}>
      {/* Double-bezel mark */}
      <span
        className={[
          'relative flex h-9 w-9 items-center justify-center rounded-[14px] p-[2px] ring-1',
          isDark ? 'bg-white/[0.06] ring-white/10' : 'bg-ink-900/[0.04] ring-ink-900/5',
        ].join(' ')}
      >
        <span
          className="relative flex h-full w-full items-center justify-center rounded-[12px] overflow-hidden"
          style={{
            background:
              'linear-gradient(135deg, #022C1F 0%, #047857 45%, #06B6D4 100%)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18)',
          }}
        >
          {/* Soft inner glow */}
          <span
            aria-hidden
            className="absolute inset-0 opacity-70"
            style={{
              background:
                'radial-gradient(120% 80% at 30% 0%, rgba(108,232,183,0.55) 0%, transparent 60%)',
            }}
          />
          {/* Shield mark */}
          <svg
            viewBox="0 0 24 24"
            className="relative h-[18px] w-[18px] text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 2.5 4 5.2v6.1c0 4.6 3.3 8.7 8 10.2 4.7-1.5 8-5.6 8-10.2V5.2L12 2.5Z" />
            <path d="m8.6 12.2 2.4 2.4 4.4-4.6" />
          </svg>
        </span>
      </span>

      {!iconOnly && (
        <span className="flex flex-col leading-none">
          <span
            className={[
              'font-display text-[17px] font-semibold tracking-tightest',
              isDark ? 'text-white' : 'text-ink-900',
            ].join(' ')}
          >
            Quiz<span className="text-primary-500">Shield</span>
          </span>
          <span
            className={[
              'mt-0.5 text-[9px] font-semibold uppercase tracking-eyebrow',
              isDark ? 'text-white/50' : 'text-ink-400',
            ].join(' ')}
          >
            Integrity&nbsp;Engine
          </span>
        </span>
      )}
    </div>
  );

  if (to) {
    return (
      <Link to={to} className="inline-flex">
        {content}
      </Link>
    );
  }
  return content;
};

export default Brand;

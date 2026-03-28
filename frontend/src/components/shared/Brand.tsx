import { Link } from 'react-router-dom';
import { ShieldCheckIcon } from '@heroicons/react/24/solid';

type BrandProps = {
  to?: string;
  className?: string;
  iconWrapperClassName?: string;
  iconClassName?: string;
  textClassName?: string;
};

const Brand = ({
  to,
  className = '',
  iconWrapperClassName = 'bg-primary-50 ring-1 ring-primary-100',
  iconClassName = 'h-5 w-5 text-primary-700',
  textClassName = 'text-lg font-semibold tracking-tight text-slate-900',
}: BrandProps) => {
  const content = (
    <div className={`flex items-center gap-2 ${className}`.trim()}>
      <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${iconWrapperClassName}`.trim()}>
        <ShieldCheckIcon className={iconClassName} aria-hidden="true" />
      </div>
      <span className={textClassName}>Quiz Shield</span>
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

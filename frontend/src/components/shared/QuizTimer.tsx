import { FiClock } from 'react-icons/fi';
import clsx from 'clsx';

interface QuizTimerProps {
  formattedTime: string;
  isWarning: boolean;
  isTimeUp: boolean;
}

const QuizTimer = ({ formattedTime, isWarning, isTimeUp }: QuizTimerProps) => {
  return (
    <div
      className={clsx(
        'flex items-center space-x-2 px-4 py-2 rounded-lg font-mono text-lg',
        {
          'bg-red-100 text-red-700': isWarning || isTimeUp,
          'bg-gray-100 text-gray-700': !isWarning && !isTimeUp
        }
      )}
    >
      <FiClock className={clsx('h-5 w-5', { 'animate-pulse': isWarning })} />
      <span className={clsx('font-bold', { 'animate-pulse': isWarning })}>
        {isTimeUp ? "Time's Up!" : formattedTime}
      </span>
    </div>
  );
};

export default QuizTimer;

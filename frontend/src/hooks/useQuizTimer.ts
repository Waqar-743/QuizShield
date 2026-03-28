import { useState, useEffect, useCallback } from 'react';

interface UseQuizTimerOptions {
  timeLimit: number; // in minutes
  onTimeUp?: () => void;
  autoStart?: boolean;
}

export const useQuizTimer = (options: UseQuizTimerOptions) => {
  const { timeLimit, onTimeUp, autoStart = true } = options;
  const [timeRemaining, setTimeRemaining] = useState(timeLimit * 60); // Convert to seconds
  const [isTimeUp, setIsTimeUp] = useState(false);
  const [isRunning, setIsRunning] = useState(autoStart);

  useEffect(() => {
    if (!isRunning || isTimeUp) return;

    const interval = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          setIsTimeUp(true);
          setIsRunning(false);
          onTimeUp?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, isTimeUp, onTimeUp]);

  const formatTime = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const start = useCallback(() => {
    setIsRunning(true);
  }, []);

  const pause = useCallback(() => {
    setIsRunning(false);
  }, []);

  const reset = useCallback(() => {
    setTimeRemaining(timeLimit * 60);
    setIsTimeUp(false);
    setIsRunning(false);
  }, [timeLimit]);

  const isWarning = timeRemaining <= 300; // Less than 5 minutes

  return {
    timeRemaining,
    formattedTime: formatTime(timeRemaining),
    isTimeUp,
    isRunning,
    isWarning,
    start,
    pause,
    reset
  };
};

export default useQuizTimer;

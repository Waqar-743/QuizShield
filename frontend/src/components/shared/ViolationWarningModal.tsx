import { FiAlertTriangle } from 'react-icons/fi';

interface ViolationWarningModalProps {
  isOpen: boolean;
  violationType: string | null;
  violationCount: number;
  onContinue: () => void;
  onExit: () => void;
}

const ViolationWarningModal = ({
  isOpen,
  violationType,
  violationCount,
  onContinue,
  onExit
}: ViolationWarningModalProps) => {
  if (!isOpen) return null;

  const getViolationMessage = (type: string | null) => {
    switch (type) {
      case 'tab_change':
        return 'You switched away from the quiz tab or window.';
      case 'copy_attempt':
        return 'You attempted to copy content from the quiz.';
      case 'right_click':
        return 'Right-click is disabled during the quiz.';
      case 'screenshot_attempt':
        return 'Screenshot attempt was detected.';
      case 'keyboard_shortcut':
        return 'A prohibited keyboard shortcut was detected.';
      default:
        return 'A security violation was detected.';
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />

        {/* Modal panel */}
        <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
          <div className="sm:flex sm:items-start">
            <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
              <FiAlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Warning: Activity Detected
              </h3>
              <div className="mt-2">
                <p className="text-sm text-gray-500">
                  {getViolationMessage(violationType)}
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  This activity has been recorded and will be visible to your teacher.
                </p>
                {violationCount > 1 && (
                  <p className="text-sm text-red-600 font-medium mt-2">
                    Total violations recorded: {violationCount}
                  </p>
                )}
              </div>
            </div>
          </div>
          <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse gap-3">
            <button
              type="button"
              onClick={onContinue}
              className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary-600 text-base font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:w-auto sm:text-sm"
            >
              Continue Quiz
            </button>
            <button
              type="button"
              onClick={onExit}
              className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:mt-0 sm:w-auto sm:text-sm"
            >
              Exit Quiz
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ViolationWarningModal;

/**
 * FaceDetectionCamera – visible camera preview with face-status indicator.
 *
 * Designed to be mounted inside the quiz-taking page.  It renders:
 *  • A small video preview (camera feed)
 *  • A coloured status badge (green/yellow/red)
 *  • An away-timer when the student looks away
 *
 * All detection logic lives in useFaceDetection; this component only owns UI.
 */

import { useFaceDetection, FaceStatus } from '../../hooks/useFaceDetection';
import { ExclamationTriangleIcon, VideoCameraIcon, VideoCameraSlashIcon } from '@heroicons/react/24/outline';

interface FaceDetectionCameraProps {
  /** Turn the whole feature on/off. */
  enabled: boolean;
  /** Called each time a face-away / no-face violation is detected (after grace). */
  onViolation?: (kind: 'face_away' | 'no_face') => void;
  /** Called when the student has been away > 60 s continuously. */
  onAutoSubmit?: () => void;
}

const statusConfig: Record<FaceStatus, { label: string; color: string; bgColor: string; pulse: boolean }> = {
  loading:           { label: 'Loading camera…',     color: 'text-blue-700',   bgColor: 'bg-blue-100',   pulse: true  },
  looking:           { label: 'Face detected ✓',     color: 'text-green-700',  bgColor: 'bg-green-100',  pulse: false },
  away:              { label: 'Face turned away!',   color: 'text-yellow-700', bgColor: 'bg-yellow-100', pulse: true  },
  no_face:           { label: 'No face detected!',   color: 'text-red-700',    bgColor: 'bg-red-100',    pulse: true  },
  error:             { label: 'Camera error',        color: 'text-red-700',    bgColor: 'bg-red-100',    pulse: false },
  permission_denied: { label: 'Camera blocked',      color: 'text-red-700',    bgColor: 'bg-red-100',    pulse: false },
};

const FaceDetectionCamera = ({ enabled, onViolation, onAutoSubmit }: FaceDetectionCameraProps) => {
  const { status, awaySeconds, violationCount, modelsLoaded, videoRef, retryCamera } = useFaceDetection(
    enabled,
    { onViolation, onAutoSubmit },
  );

  if (!enabled) return null;

  const cfg = statusConfig[status];

  return (
    <div className="fixed top-20 left-4 z-30 w-52">
      {/* Camera preview */}
      <div className="relative rounded-xl overflow-hidden border-2 border-gray-200 shadow-lg bg-black">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-36 object-cover mirror"
          style={{ transform: 'scaleX(-1)' }}
        />

        {/* Status overlay badge */}
        <div className={`absolute bottom-1 left-1 right-1 flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-semibold ${cfg.bgColor} ${cfg.color} ${cfg.pulse ? 'animate-pulse' : ''}`}>
          {status === 'looking' ? (
            <VideoCameraIcon className="h-3.5 w-3.5 flex-shrink-0" />
          ) : status === 'permission_denied' || status === 'error' ? (
            <VideoCameraSlashIcon className="h-3.5 w-3.5 flex-shrink-0" />
          ) : (
            <ExclamationTriangleIcon className="h-3.5 w-3.5 flex-shrink-0" />
          )}
          <span className="truncate">{cfg.label}</span>
        </div>

        {/* Loading overlay */}
        {(status === 'loading') && (
          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white text-xs gap-2">
            <div className="animate-spin h-6 w-6 border-2 border-white border-t-transparent rounded-full" />
            <span>{modelsLoaded ? 'Starting camera…' : 'Loading AI models…'}</span>
          </div>
        )}

        {/* Permission denied overlay */}
        {status === 'permission_denied' && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-white text-xs gap-2 px-3 text-center">
            <VideoCameraSlashIcon className="h-8 w-8 text-red-400" />
            <span className="font-semibold">Camera access denied</span>
            <div className="text-gray-300 text-[10px] leading-tight space-y-1">
              <p>To fix this:</p>
              <p>1. Click the 🔒 icon in the address bar</p>
              <p>2. Find "Camera" → set to <strong>Allow</strong></p>
              <p>3. Click the button below</p>
            </div>
            <button
              onClick={retryCamera}
              className="mt-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-md transition-colors"
            >
              🔄 Retry Camera
            </button>
          </div>
        )}

        {/* Error overlay */}
        {status === 'error' && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-white text-xs gap-2 px-3 text-center">
            <VideoCameraSlashIcon className="h-8 w-8 text-red-400" />
            <span className="font-semibold">Camera error</span>
            <span className="text-gray-300 text-[10px]">No camera found or camera is in use by another app.</span>
            <button
              onClick={retryCamera}
              className="mt-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-md transition-colors"
            >
              🔄 Retry
            </button>
          </div>
        )}
      </div>

      {/* Away timer – only visible when looking away */}
      {(status === 'away' || status === 'no_face') && awaySeconds > 0 && (
        <div className="mt-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center justify-between text-xs">
            <span className="text-red-700 font-semibold">Away timer</span>
            <span className={`font-mono font-bold ${awaySeconds >= 45 ? 'text-red-600 animate-pulse' : 'text-red-500'}`}>
              {awaySeconds}s / 60s
            </span>
          </div>
          <div className="mt-1 h-1.5 bg-red-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-red-500 transition-all duration-500"
              style={{ width: `${Math.min(100, (awaySeconds / 60) * 100)}%` }}
            />
          </div>
          {awaySeconds >= 45 && (
            <p className="mt-1 text-[10px] text-red-600 font-medium">
              ⚠ Quiz will auto-submit at 60 s!
            </p>
          )}
        </div>
      )}

      {/* Violation counter */}
      {violationCount > 0 && (
        <div className="mt-2 px-3 py-1.5 bg-orange-50 border border-orange-200 rounded-lg flex items-center justify-between text-xs">
          <span className="text-orange-700">Camera violations</span>
          <span className="font-bold text-orange-600">{violationCount}</span>
        </div>
      )}
    </div>
  );
};

export default FaceDetectionCamera;

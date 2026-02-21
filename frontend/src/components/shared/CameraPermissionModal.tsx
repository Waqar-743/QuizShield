/**
 * CameraPermissionModal – Requests camera permission before starting a quiz.
 *
 * Shown when the student clicks "Start Quiz". It:
 *  1. Asks the browser for camera access.
 *  2. Shows a live camera preview so the student can see themselves.
 *  3. Only allows proceeding once the camera works.
 *  4. On denial, shows clear instructions to fix it.
 */

import { useEffect, useRef, useState } from 'react';
import {
  VideoCameraIcon,
  VideoCameraSlashIcon,
  ExclamationTriangleIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';

type PermissionState = 'requesting' | 'granted' | 'denied' | 'error';

interface CameraPermissionModalProps {
  isOpen: boolean;
  onAllow: () => void;    // called when camera is working and student clicks "Continue"
  onCancel: () => void;   // called when student cancels
  quizTitle?: string;
}

const CameraPermissionModal = ({ isOpen, onAllow, onCancel, quizTitle }: CameraPermissionModalProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [permState, setPermState] = useState<PermissionState>('requesting');
  const [retrying, setRetrying] = useState(false);

  const requestCamera = async () => {
    setPermState('requesting');
    setRetrying(true);

    try {
      // Stop any previous stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: 'user' },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setPermState('granted');
    } catch (err: any) {
      console.error('[CameraPermission] Error:', err);
      if (err.name === 'NotAllowedError') {
        setPermState('denied');
      } else {
        setPermState('error');
      }
    } finally {
      setRetrying(false);
    }
  };

  // Request camera when modal opens
  useEffect(() => {
    if (!isOpen) return;

    requestCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
  }, [isOpen]);

  const handleContinue = () => {
    // Stop the preview stream — the quiz page will start its own
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    onAllow();
  };

  const handleCancel = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    onCancel();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center px-4 py-8">
        {/* Backdrop */}
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />

        {/* Modal */}
        <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-5">
          {/* Header */}
          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 mb-3">
              <ShieldCheckIcon className="h-7 w-7 text-blue-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Camera Required for Quiz</h3>
            {quizTitle && (
              <p className="text-sm text-gray-500 mt-1">"{quizTitle}"</p>
            )}
            <p className="text-sm text-gray-600 mt-2">
              This quiz uses <strong>face detection proctoring</strong>. Your camera must be enabled to start.
            </p>
          </div>

          {/* Camera Preview Area */}
          <div className="relative rounded-xl overflow-hidden border-2 border-gray-200 bg-black mx-auto" style={{ maxWidth: 320 }}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-48 object-cover"
              style={{ transform: 'scaleX(-1)' }}
            />

            {/* Requesting overlay */}
            {permState === 'requesting' && (
              <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-white gap-3">
                <div className="animate-spin h-8 w-8 border-3 border-white border-t-transparent rounded-full" />
                <p className="text-sm font-medium">Requesting camera access…</p>
                <p className="text-xs text-gray-300">Please click "Allow" in the browser popup</p>
              </div>
            )}

            {/* Granted overlay */}
            {permState === 'granted' && (
              <div className="absolute bottom-2 left-2 right-2 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500/90 text-white text-xs font-semibold">
                <VideoCameraIcon className="h-4 w-4" />
                Camera is working — you can see yourself!
              </div>
            )}

            {/* Denied overlay */}
            {permState === 'denied' && (
              <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-white gap-3 px-4 text-center">
                <VideoCameraSlashIcon className="h-10 w-10 text-red-400" />
                <p className="font-semibold text-red-300">Camera Access Blocked</p>
                <div className="text-xs text-gray-300 space-y-1">
                  <p>Your browser blocked camera access. To fix:</p>
                  <p>1. Click the <strong>🔒 lock icon</strong> in the address bar</p>
                  <p>2. Find <strong>Camera</strong> → change to <strong>Allow</strong></p>
                  <p>3. Click <strong>"Try Again"</strong> below</p>
                </div>
              </div>
            )}

            {/* Error overlay */}
            {permState === 'error' && (
              <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-white gap-3 px-4 text-center">
                <ExclamationTriangleIcon className="h-10 w-10 text-yellow-400" />
                <p className="font-semibold">Camera Error</p>
                <p className="text-xs text-gray-300">
                  No camera found or it's being used by another app. Close other apps and try again.
                </p>
              </div>
            )}
          </div>

          {/* Proctoring info */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <ExclamationTriangleIcon className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-amber-800 space-y-1">
                <p className="font-semibold">Proctoring Rules:</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>Keep your face visible in the camera at all times</li>
                  <li>Do not look away from the screen for extended periods</li>
                  <li>Do not switch tabs or windows during the quiz</li>
                  <li>Quiz will auto-submit if you look away for 60+ seconds</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleCancel}
              className="flex-1 py-2.5 px-4 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>

            {permState === 'granted' ? (
              <button
                onClick={handleContinue}
                className="flex-1 py-2.5 px-4 border border-transparent rounded-xl text-sm font-bold text-white bg-green-600 hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
              >
                <VideoCameraIcon className="h-5 w-5" />
                Start Quiz
              </button>
            ) : (
              <button
                onClick={requestCamera}
                disabled={retrying}
                className="flex-1 py-2.5 px-4 border border-transparent rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {retrying ? (
                  <>
                    <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                    Requesting…
                  </>
                ) : (
                  <>
                    <VideoCameraIcon className="h-5 w-5" />
                    Try Again
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CameraPermissionModal;

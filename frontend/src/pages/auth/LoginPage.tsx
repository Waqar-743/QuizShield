import { useState, useRef, useCallback, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useAuthStore } from '../../store/authStore';
import toast from 'react-hot-toast';
import * as faceapi from 'face-api.js';
import {
  VideoCameraIcon,
  VideoCameraSlashIcon,
  ArrowPathIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';

const MODEL_URL = `${import.meta.env.BASE_URL}models`;

const LoginPage = () => {
  const { login, verifyFaceLogin, cancelFaceVerification, faceVerificationPending, isLoading } = useAuthStore();
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors } } = useForm();

  // Camera state
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // Step 1: Password login
  const onPasswordSubmit = async (data: any) => {
    try {
      await login(data);
      // If no face verification required, login() already set isAuthenticated
    } catch (error: any) {
      const message = error.response?.data?.message || error.response?.data?.error?.message || 'Login failed';
      toast.error(message);
    }
  };

  // Redirect when authenticated
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  useEffect(() => {
    if (isAuthenticated) {
      toast.success('Logged in successfully!');
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  // Load face-api models when entering face verification step
  useEffect(() => {
    if (!faceVerificationPending) return;

    let cancelled = false;
    (async () => {
      try {
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
        await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
        if (!cancelled) setModelsLoaded(true);
      } catch (err) {
        console.error('Failed to load face models:', err);
        if (!cancelled) setCameraError('Failed to load face recognition models.');
      }
    })();

    return () => { cancelled = true; };
  }, [faceVerificationPending]);

  // Start camera when models are loaded
  useEffect(() => {
    if (!faceVerificationPending || !modelsLoaded) return;

    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 480, height: 360, facingMode: 'user' },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setCameraReady(true);
        }
      } catch (err: any) {
        if (!cancelled) {
          if (err.name === 'NotAllowedError') {
            setCameraError('Camera access denied. Please allow camera access in your browser settings and try again.');
          } else if (err.name === 'NotFoundError') {
            setCameraError('No camera found on this device.');
          } else {
            setCameraError('Could not start camera. It may be in use by another app.');
          }
        }
      }
    })();

    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [faceVerificationPending, modelsLoaded]);

  // Capture & Verify
  const handleCaptureAndVerify = useCallback(async () => {
    if (!videoRef.current || !cameraReady) return;

    setVerifying(true);
    setVerifyError(null);

    try {
      const detection = await faceapi
        .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.5 }))
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        setVerifyError('No face detected. Please look directly at the camera and try again.');
        setVerifying(false);
        return;
      }

      const encoding = Array.from(detection.descriptor);
      await verifyFaceLogin(encoding);
    } catch (error: any) {
      const message = error.response?.data?.message || error.response?.data?.error?.message || error.message || 'Verification failed';
      setVerifyError(message);
    } finally {
      setVerifying(false);
    }
  }, [cameraReady, verifyFaceLogin]);

  // Cancel and go back to password step
  const handleCancel = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraReady(false);
    setCameraError(null);
    setVerifyError(null);
    setModelsLoaded(false);
    cancelFaceVerification();
  }, [cancelFaceVerification]);

  // ---- Face Verification Step ----
  if (faceVerificationPending) {
    return (
      <div>
        <div className="flex items-center justify-center gap-2 mb-2">
          <ShieldCheckIcon className="h-8 w-8 text-primary-600" />
        </div>
        <h2 className="text-center text-2xl font-extrabold text-gray-900">
          Face Verification Required
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Welcome back, <span className="font-semibold">{faceVerificationPending.userName}</span>. Please verify your identity using your camera. If this is your first time, your face will be enrolled for future logins.
        </p>

        <div className="mt-6 space-y-4">
          {/* Camera preview */}
          <div className="relative rounded-xl overflow-hidden border-2 border-gray-200 bg-black aspect-[4/3]">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              style={{ transform: 'scaleX(-1)' }}
            />

            {/* Loading overlay */}
            {!cameraReady && !cameraError && (
              <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-white gap-3">
                <div className="animate-spin h-8 w-8 border-2 border-white border-t-transparent rounded-full" />
                <span className="text-sm">
                  {modelsLoaded ? 'Starting camera...' : 'Loading face recognition models...'}
                </span>
              </div>
            )}

            {/* Camera error overlay */}
            {cameraError && (
              <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-white gap-3 px-4 text-center">
                <VideoCameraSlashIcon className="h-10 w-10 text-red-400" />
                <p className="text-sm">{cameraError}</p>
              </div>
            )}

            {/* Face guide overlay */}
            {cameraReady && !verifying && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-48 h-60 border-2 border-dashed border-white/50 rounded-full" />
              </div>
            )}

            {/* Verifying overlay */}
            {verifying && (
              <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-white gap-3">
                <div className="animate-spin h-8 w-8 border-2 border-white border-t-transparent rounded-full" />
                <span className="text-sm font-medium">Verifying your face...</span>
              </div>
            )}
          </div>

          {/* Error message */}
          {verifyError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              {verifyError}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleCancel}
              className="flex-1 py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Back to Login
            </button>
            <button
              onClick={handleCaptureAndVerify}
              disabled={!cameraReady || verifying || isLoading}
              className="flex-1 flex justify-center items-center gap-2 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50"
            >
              {verifying || isLoading ? (
                <>
                  <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                  Verifying...
                </>
              ) : verifyError ? (
                <>
                  <ArrowPathIcon className="h-4 w-4" />
                  Retry
                </>
              ) : (
                <>
                  <VideoCameraIcon className="h-4 w-4" />
                  Capture & Verify
                </>
              )}
            </button>
          </div>

          <p className="text-xs text-gray-400 text-center">
            Your live image is used for verification only and is not stored.
          </p>
        </div>
      </div>
    );
  }

  // ---- Standard Password Step ----
  return (
    <div>
      <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
        Sign in to your account
      </h2>
      <p className="mt-2 text-center text-sm text-gray-600">
        Or{' '}
        <Link to="/register" className="font-medium text-primary-600 hover:text-primary-500">
          create a new account
        </Link>
      </p>

      <div className="mt-8">
        <form className="space-y-6" onSubmit={handleSubmit(onPasswordSubmit)}>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email address
            </label>
            <div className="mt-1">
              <input
                id="email"
                type="email"
                autoComplete="email"
                className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                {...register('email', { 
                  required: 'Email is required',
                  pattern: {
                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                    message: 'Invalid email address'
                  }
                })}
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email.message as string}</p>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <div className="mt-1">
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                {...register('password', { required: 'Password is required' })}
              />
              {errors.password && (
                <p className="mt-1 text-sm text-red-600">{errors.password.message as string}</p>
              )}
            </div>
            <div className="mt-2 text-right">
              <Link to="/forgot-password" className="text-sm font-medium text-primary-600 hover:text-primary-500">
                Forgot password?
              </Link>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
            >
              {isLoading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;

/**
 * useFaceDetection – Standalone face-detection hook for QuizShield.
 *
 * Uses face-api.js (TinyFaceDetector + 68-point landmarks) running entirely
 * in the browser.  No backend calls are needed for detection itself.
 *
 * Responsibilities:
 *  1. Request webcam access via getUserMedia.
 *  2. Load ML models from /models (served as static assets).
 *  3. Run a detection loop every ~500 ms.
 *  4. Estimate head-pose (yaw / pitch) from the 68 landmarks.
 *  5. Maintain a state machine:
 *       LOOKING  →  face present & forward
 *       AWAY     →  no face OR head turned beyond thresholds
 *       AUTO_SUBMIT → continuously away > AWAY_LIMIT_SEC
 *  6. Expose callbacks so the consumer can report violations.
 *
 * The hook is intentionally decoupled from the violation-reporting HTTP layer
 * so it can be tested in isolation.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import * as faceapi from 'face-api.js';

/* ---------- configurable constants --------- */
const DETECTION_INTERVAL_MS = 500;          // run detection every 500 ms
const YAW_THRESHOLD   = 30;                 // degrees
const PITCH_THRESHOLD = 25;                 // degrees
const SMOOTHING_WINDOW = 5;                 // frames to average
const SMOOTHING_MAJORITY = 3;              // ≥3 out of 5 = away
const GRACE_PERIOD_MS = 2_000;             // ignore first 2 s of "away"
const AWAY_LIMIT_SEC  = 60;                // auto-submit after 60 s away
const MODEL_URL = '/models';               // relative to public/

/* ---------- types ---------- */
export type FaceStatus = 'loading' | 'looking' | 'away' | 'no_face' | 'error' | 'permission_denied';

export interface FaceDetectionCallbacks {
  /** Called each time status transitions to 'away' or 'no_face' (after grace). */
  onViolation?: (kind: 'face_away' | 'no_face') => void;
  /** Called when the student has been continuously away > AWAY_LIMIT_SEC. */
  onAutoSubmit?: () => void;
}

export interface FaceDetectionState {
  status: FaceStatus;
  /** Accumulated seconds the student has been continuously looking away. */
  awaySeconds: number;
  /** Total number of face-away violation events fired. */
  violationCount: number;
  /** Whether the ML models have finished loading. */
  modelsLoaded: boolean;
  /** Reference to attach to a <video> element for the camera preview. */
  videoRef: React.RefObject<HTMLVideoElement>;
  /** Call to retry camera access after permission was denied. */
  retryCamera: () => void;
}

/* ---- lightweight head-pose from 68 landmarks ---- */
function estimateHeadPose(landmarks: faceapi.FaceLandmarks68) {
  const pts = landmarks.positions;

  // Key points
  const noseTip   = pts[30];  // tip of nose
  const chin      = pts[8];   // bottom of chin
  const leftEye   = pts[36];  // left-eye outer corner
  const rightEye  = pts[45];  // right-eye outer corner
  const leftMouth = pts[48];
  const rightMouth = pts[54];

  // Face width (eye-to-eye) and height (nose-to-chin) as reference
  const faceWidth  = Math.hypot(rightEye.x - leftEye.x, rightEye.y - leftEye.y);
  const faceHeight = Math.hypot(chin.x - noseTip.x, chin.y - noseTip.y);

  if (faceWidth === 0 || faceHeight === 0) return { yaw: 0, pitch: 0 };

  // ---- Yaw (left / right) ----
  // Ratio of nose-tip horizontal offset from face centre, normalised by face width.
  const faceCenterX = (leftEye.x + rightEye.x) / 2;
  const noseOffsetX = noseTip.x - faceCenterX;
  const yaw = (noseOffsetX / (faceWidth / 2)) * 45;   // rough degrees

  // ---- Pitch (up / down) ----
  const mouthCenterY = (leftMouth.y + rightMouth.y) / 2;
  const eyeCenterY   = (leftEye.y + rightEye.y) / 2;
  const vertRef      = mouthCenterY - eyeCenterY;
  const noseOffsetY  = noseTip.y - eyeCenterY;
  const pitch = vertRef === 0 ? 0 : ((noseOffsetY / vertRef) - 0.55) * 80; // rough degrees

  return { yaw, pitch };
}

/* ---- the hook ---- */
export function useFaceDetection(
  enabled: boolean,
  callbacks: FaceDetectionCallbacks = {},
): FaceDetectionState {
  const videoRef = useRef<HTMLVideoElement>(null!);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const awayStartRef = useRef<number | null>(null);
  const lastStatusRef = useRef<'looking' | 'away'>('looking');
  const smoothingBuffer = useRef<boolean[]>([]);    // true = looking, false = away/no-face

  const [status, setStatus] = useState<FaceStatus>('loading');
  const [awaySeconds, setAwaySeconds] = useState(0);
  const [violationCount, setViolationCount] = useState(0);
  const [modelsLoaded, setModelsLoaded] = useState(false);

  // Keep callbacks in a ref so the detection loop can read the latest version
  const cbRef = useRef(callbacks);
  cbRef.current = callbacks;

  /* ---- 1. Load face-api models ---- */
  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    (async () => {
      try {
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
        if (!cancelled) {
          setModelsLoaded(true);
          console.log('[FaceDetection] Models loaded');
        }
      } catch (err) {
        console.error('[FaceDetection] Failed to load models:', err);
        if (!cancelled) setStatus('error');
      }
    })();

    return () => { cancelled = true; };
  }, [enabled]);

  /* ---- 2. Start camera ---- */
  const [cameraRetryCount, setCameraRetryCount] = useState(0);

  const startCamera = useCallback(async () => {
    // First check if permission is already permanently denied
    try {
      if (navigator.permissions && navigator.permissions.query) {
        const permResult = await navigator.permissions.query({ name: 'camera' as PermissionName });
        if (permResult.state === 'denied') {
          console.warn('[FaceDetection] Camera permission is permanently denied in browser settings');
          setStatus('permission_denied');
          return null;
        }
        // If 'prompt', the browser will ask; if 'granted', it's already allowed
        console.log('[FaceDetection] Camera permission state:', permResult.state);
      }
    } catch {
      // permissions.query may not support 'camera' in all browsers — continue anyway
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: 'user' },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setStatus('looking');
      console.log('[FaceDetection] Camera started successfully');
      return stream;
    } catch (err: any) {
      console.error('[FaceDetection] Camera access error:', err);

      if (err.name === 'NotAllowedError') {
        setStatus('permission_denied');
      } else if (err.name === 'NotFoundError') {
        console.error('[FaceDetection] No camera device found');
        setStatus('error');
      } else if (err.name === 'NotReadableError') {
        console.error('[FaceDetection] Camera is in use by another app');
        setStatus('error');
      } else {
        setStatus('error');
      }
      return null;
    }
  }, []);

  /** Retry camera access — call after the user resets browser permissions */
  const retryCamera = useCallback(() => {
    // Stop any existing stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setStatus('loading');
    setCameraRetryCount(c => c + 1);
  }, []);

  useEffect(() => {
    if (!enabled || !modelsLoaded) return;

    let cancelled = false;

    (async () => {
      const stream = await startCamera();
      if (cancelled && stream) {
        stream.getTracks().forEach(t => t.stop());
      }
    })();

    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
  }, [enabled, modelsLoaded, cameraRetryCount, startCamera]);

  /* ---- helper: process a single detection result ---- */
  const processDetection = useCallback((isLooking: boolean) => {
    // Smoothing: keep last N results, only trigger if majority agree
    const buf = smoothingBuffer.current;
    buf.push(isLooking);
    if (buf.length > SMOOTHING_WINDOW) buf.shift();

    const lookingCount = buf.filter(Boolean).length;
    const smoothedLooking = lookingCount >= SMOOTHING_MAJORITY;

    const now = Date.now();

    if (smoothedLooking) {
      // Back to looking
      if (lastStatusRef.current === 'away') {
        console.log('[FaceDetection] Face returned — resetting timer');
      }
      lastStatusRef.current = 'looking';
      awayStartRef.current = null;
      setStatus('looking');
      setAwaySeconds(0);
    } else {
      // Away / no face
      if (lastStatusRef.current === 'looking') {
        // Just transitioned to away – start grace timer
        awayStartRef.current = now;
        lastStatusRef.current = 'away';
      }

      const awayStart = awayStartRef.current!;
      const elapsedMs = now - awayStart;

      // Grace period: don't count brief glances
      if (elapsedMs < GRACE_PERIOD_MS) {
        return; // still in grace period
      }

      const elapsedSec = Math.round(elapsedMs / 1000);
      setAwaySeconds(elapsedSec);
      setStatus(isLooking ? 'looking' : (buf.some(b => !b) ? 'away' : 'no_face'));

      // Fire violation on first frame past grace
      if (elapsedMs >= GRACE_PERIOD_MS && elapsedMs < GRACE_PERIOD_MS + DETECTION_INTERVAL_MS + 100) {
        setViolationCount(c => c + 1);
        cbRef.current.onViolation?.(isLooking ? 'face_away' : 'no_face');
      }

      // Auto-submit check
      if (elapsedSec >= AWAY_LIMIT_SEC) {
        console.warn('[FaceDetection] Away for >60 s – triggering auto-submit');
        cbRef.current.onAutoSubmit?.();
      }
    }
  }, []);

  /* ---- 3. Detection loop ---- */
  useEffect(() => {
    if (!enabled || !modelsLoaded || status === 'error' || status === 'permission_denied') return;

    const video = videoRef.current;
    if (!video) return;

    intervalRef.current = setInterval(async () => {
      if (video.paused || video.ended || video.readyState < 2) return;

      try {
        const detection = await faceapi
          .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.45 }))
          .withFaceLandmarks();

        if (!detection) {
          processDetection(false);
          return;
        }

        const { yaw, pitch } = estimateHeadPose(detection.landmarks);
        const isLooking = Math.abs(yaw) <= YAW_THRESHOLD && Math.abs(pitch) <= PITCH_THRESHOLD;
        processDetection(isLooking);
      } catch (err) {
        // frame processing error — skip silently
      }
    }, DETECTION_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [enabled, modelsLoaded, status, processDetection]);

  /* ---- Cleanup on unmount ---- */
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  return { status, awaySeconds, violationCount, modelsLoaded, videoRef, retryCamera };
}

export default useFaceDetection;

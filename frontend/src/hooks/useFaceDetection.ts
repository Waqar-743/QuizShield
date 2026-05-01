/**
 * useFaceDetection – Standalone face-detection hook for QuizShield.
 *
 * Uses face-api.js (TinyFaceDetector + 68-point landmarks) running entirely
 * in the browser. No backend calls are needed for detection itself.
 *
 * Key fixes applied:
 *  - Detection loop uses recursive setTimeout (not setInterval) so slow ML
 *    inference on low-end devices never queues up concurrent detections.
 *  - Camera-blocked states fire continuous no_face violations so students
 *    cannot bypass proctoring by denying camera mid-exam.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import * as faceapi from 'face-api.js';

/* ---------- configurable constants --------- */
const DETECTION_INTERVAL_MS  = 500;
const YAW_THRESHOLD           = 30;
const PITCH_THRESHOLD         = 25;
const SMOOTHING_WINDOW        = 5;
const SMOOTHING_MAJORITY      = 3;
const GRACE_PERIOD_MS         = 2_000;
const AWAY_LIMIT_SEC          = 60;
const CAMERA_BLOCKED_PING_MS  = 10_000; // fire no_face every 10 s when camera is blocked
const MODEL_URL = `${import.meta.env.BASE_URL}models`;

/* ---------- types ---------- */
export type FaceStatus = 'loading' | 'looking' | 'away' | 'no_face' | 'error' | 'permission_denied';

export interface FaceDetectionCallbacks {
  onViolation?: (kind: 'face_away' | 'no_face') => void;
  onAutoSubmit?: () => void;
}

export interface FaceDetectionState {
  status: FaceStatus;
  awaySeconds: number;
  violationCount: number;
  modelsLoaded: boolean;
  videoRef: React.RefObject<HTMLVideoElement>;
  retryCamera: () => void;
}

/* ---- lightweight head-pose from 68 landmarks ---- */
function estimateHeadPose(landmarks: faceapi.FaceLandmarks68) {
  const pts = landmarks.positions;

  const noseTip    = pts[30];
  const chin       = pts[8];
  const leftEye    = pts[36];
  const rightEye   = pts[45];
  const leftMouth  = pts[48];
  const rightMouth = pts[54];

  const faceWidth  = Math.hypot(rightEye.x - leftEye.x, rightEye.y - leftEye.y);
  const faceHeight = Math.hypot(chin.x - noseTip.x, chin.y - noseTip.y);

  if (faceWidth === 0 || faceHeight === 0) return { yaw: 0, pitch: 0 };

  const faceCenterX = (leftEye.x + rightEye.x) / 2;
  const noseOffsetX = noseTip.x - faceCenterX;
  const yaw = (noseOffsetX / (faceWidth / 2)) * 45;

  const mouthCenterY = (leftMouth.y + rightMouth.y) / 2;
  const eyeCenterY   = (leftEye.y + rightEye.y) / 2;
  const vertRef      = mouthCenterY - eyeCenterY;
  const noseOffsetY  = noseTip.y - eyeCenterY;
  const pitch = vertRef === 0 ? 0 : ((noseOffsetY / vertRef) - 0.55) * 80;

  return { yaw, pitch };
}

/* ---- the hook ---- */
export function useFaceDetection(
  enabled: boolean,
  callbacks: FaceDetectionCallbacks = {},
): FaceDetectionState {
  const videoRef        = useRef<HTMLVideoElement>(null!);
  const streamRef       = useRef<MediaStream | null>(null);
  const timerRef        = useRef<ReturnType<typeof setTimeout> | null>(null);
  const awayStartRef    = useRef<number | null>(null);
  const lastStatusRef   = useRef<'looking' | 'away'>('looking');
  const smoothingBuffer = useRef<boolean[]>([]);
  const isDetecting     = useRef(false); // prevents concurrent ML calls

  const [status,        setStatus]        = useState<FaceStatus>('loading');
  const [awaySeconds,   setAwaySeconds]   = useState(0);
  const [violationCount,setViolationCount]= useState(0);
  const [modelsLoaded,  setModelsLoaded]  = useState(false);
  const [cameraRetryCount, setCameraRetryCount] = useState(0);

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
        if (!cancelled) setModelsLoaded(true);
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();

    return () => { cancelled = true; };
  }, [enabled]);

  /* ---- 2. Start camera ---- */
  const startCamera = useCallback(async () => {
    try {
      if (navigator.permissions?.query) {
        const permResult = await navigator.permissions.query({ name: 'camera' as PermissionName });
        if (permResult.state === 'denied') {
          setStatus('permission_denied');
          return null;
        }
      }
    } catch { /* permissions.query may not support 'camera' — continue */ }

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
      return stream;
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        setStatus('permission_denied');
      } else {
        setStatus('error');
      }
      return null;
    }
  }, []);

  const retryCamera = useCallback(() => {
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
      if (cancelled && stream) stream.getTracks().forEach(t => t.stop());
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
    const buf = smoothingBuffer.current;
    buf.push(isLooking);
    if (buf.length > SMOOTHING_WINDOW) buf.shift();

    const smoothedLooking = buf.filter(Boolean).length >= SMOOTHING_MAJORITY;
    const now = Date.now();

    if (smoothedLooking) {
      lastStatusRef.current = 'looking';
      awayStartRef.current  = null;
      setStatus('looking');
      setAwaySeconds(0);
    } else {
      if (lastStatusRef.current === 'looking') {
        awayStartRef.current = now;
        lastStatusRef.current = 'away';
      }

      const awayStart  = awayStartRef.current!;
      const elapsedMs  = now - awayStart;

      if (elapsedMs < GRACE_PERIOD_MS) return;

      const elapsedSec = Math.round(elapsedMs / 1000);
      setAwaySeconds(elapsedSec);
      setStatus(buf.some(b => !b) ? 'away' : 'no_face');

      // Fire violation once per grace-period crossing
      if (elapsedMs >= GRACE_PERIOD_MS && elapsedMs < GRACE_PERIOD_MS + DETECTION_INTERVAL_MS + 100) {
        setViolationCount(c => c + 1);
        cbRef.current.onViolation?.(isLooking ? 'face_away' : 'no_face');
      }

      if (elapsedSec >= AWAY_LIMIT_SEC) {
        cbRef.current.onAutoSubmit?.();
      }
    }
  }, []);

  /* ---- 3. Detection loop — recursive setTimeout prevents queued-up calls ---- */
  useEffect(() => {
    if (!enabled || !modelsLoaded || status === 'error' || status === 'permission_denied') return;

    const video = videoRef.current;
    if (!video) return;

    let cancelled = false;

    const runDetection = async () => {
      if (cancelled) return;

      if (!isDetecting.current && !video.paused && !video.ended && video.readyState >= 2) {
        isDetecting.current = true;
        try {
          const detection = await faceapi
            .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.45 }))
            .withFaceLandmarks();

          if (!cancelled) {
            if (!detection) {
              processDetection(false);
            } else {
              const { yaw, pitch } = estimateHeadPose(detection.landmarks);
              processDetection(Math.abs(yaw) <= YAW_THRESHOLD && Math.abs(pitch) <= PITCH_THRESHOLD);
            }
          }
        } catch { /* skip frame silently */ }
        isDetecting.current = false;
      }

      if (!cancelled) {
        timerRef.current = setTimeout(runDetection, DETECTION_INTERVAL_MS);
      }
    };

    runDetection();

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled, modelsLoaded, status, processDetection]);

  /* ---- 4. Camera-blocked ping — fire no_face violations so students cannot
            bypass proctoring by denying camera access mid-exam ---- */
  useEffect(() => {
    if (!enabled) return;
    if (status !== 'permission_denied' && status !== 'error') return;

    const interval = setInterval(() => {
      setViolationCount(c => c + 1);
      cbRef.current.onViolation?.('no_face');
    }, CAMERA_BLOCKED_PING_MS);

    return () => clearInterval(interval);
  }, [status, enabled]);

  /* ---- Cleanup on unmount ---- */
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  return { status, awaySeconds, violationCount, modelsLoaded, videoRef, retryCamera };
}

export default useFaceDetection;

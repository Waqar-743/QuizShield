import { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useAuthStore } from '../../store/authStore';
import toast from 'react-hot-toast';
import { CameraIcon, XMarkIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import * as faceapi from 'face-api.js';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/jpg'];
const MODEL_URL = `${import.meta.env.BASE_URL}models`;

const RegisterPage = () => {
  const { register: registerUser, isLoading } = useAuthStore();
  const navigate = useNavigate();
  const { register, handleSubmit, watch, formState: { errors } } = useForm();
  const password = watch('password');
  const role = watch('role', 'student');

  const [profilePreview, setProfilePreview] = useState<string | null>(null);
  const [profileFile, setProfileFile] = useState<File | null>(null);
  const [pictureError, setPictureError] = useState<string | null>(null);
  const [faceEncoding, setFaceEncoding] = useState<number[] | null>(null);
  const [extractingFace, setExtractingFace] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const extractFaceEncoding = async (imgElement: HTMLImageElement): Promise<number[] | null> => {
    setExtractingFace(true);
    try {
      console.log('[Register] Loading face-api models from:', MODEL_URL);
      await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
      console.log('[Register] tinyFaceDetector loaded');
      await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
      console.log('[Register] faceLandmark68Net loaded');
      await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
      console.log('[Register] faceRecognitionNet loaded');

      console.log('[Register] Running face detection on image:', imgElement.width, 'x', imgElement.height);
      const detection = await faceapi
        .detectSingleFace(imgElement, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.5 }))
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        console.warn('[Register] No face detected in uploaded image');
        setPictureError('No face detected in the image. Please upload a clear photo of your face.');
        return null;
      }

      const descriptor = Array.from(detection.descriptor);
      console.log('[Register] Face encoding extracted successfully, length:', descriptor.length, 'first 3 values:', descriptor.slice(0, 3));
      return descriptor;
    } catch (err) {
      console.error('[Register] Face encoding extraction FAILED:', err);
      setPictureError('Failed to process face data. Please try a different image.');
      return null;
    } finally {
      setExtractingFace(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setPictureError(null);
    setFaceEncoding(null);

    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      setPictureError('Only JPG and PNG images are allowed.');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setPictureError('Image must be smaller than 5MB.');
      return;
    }

    setProfileFile(file);

    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
    setProfilePreview(dataUrl);

    // Extract face encoding from uploaded image
    const img = new Image();
    img.src = dataUrl;
    await new Promise((resolve) => { img.onload = resolve; });
    const encoding = await extractFaceEncoding(img);
    if (encoding) {
      setFaceEncoding(encoding);
    }
  };

  const removeProfilePicture = () => {
    setProfileFile(null);
    setProfilePreview(null);
    setPictureError(null);
    setFaceEncoding(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const onSubmit = async (data: any) => {
    try {
      let profilePictureBase64: string | undefined;
      if (data.role === 'student' && profileFile) {
        profilePictureBase64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(profileFile);
        });
      }

      console.log('[Register] Submitting registration. role:', data.role, '| has profilePicture:', !!profilePictureBase64, '| has faceEncoding:', !!faceEncoding, '| encoding length:', faceEncoding?.length);
      await registerUser({
        ...data,
        profilePictureBase64,
        faceEncoding: data.role === 'student' ? (faceEncoding || undefined) : undefined,
      });
      toast.success('Registration complete. Please log in.');
      navigate('/login');
    } catch (error: any) {
      const message = error.response?.data?.message || error.response?.data?.error?.message || 'Registration failed';
      toast.error(message);
    }
  };

  return (
    <div>
      <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
        Create your account
      </h2>
      <p className="mt-2 text-center text-sm text-gray-600">
        Or{' '}
        <Link to="/login" className="font-medium text-primary-600 hover:text-primary-500">
          sign in to existing account
        </Link>
      </p>

      <div className="mt-8">
        <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              Full Name
            </label>
            <div className="mt-1">
              <input
                id="name"
                type="text"
                autoComplete="name"
                className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                {...register('name', { 
                  required: 'Name is required',
                  minLength: { value: 2, message: 'Name must be at least 2 characters' }
                })}
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-600">{errors.name.message as string}</p>
              )}
            </div>
          </div>

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
            <label htmlFor="role" className="block text-sm font-medium text-gray-700">
              I am a
            </label>
            <div className="mt-1">
              <select
                id="role"
                className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
                {...register('role')}
              >
                <option value="student">Student</option>
                <option value="teacher">Teacher</option>
              </select>
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
                autoComplete="new-password"
                className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                {...register('password', { 
                  required: 'Password is required',
                  minLength: { value: 8, message: 'Password must be at least 8 characters' },
                  pattern: {
                    value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
                    message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number'
                  }
                })}
              />
              {errors.password && (
                <p className="mt-1 text-sm text-red-600">{errors.password.message as string}</p>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
              Confirm Password
            </label>
            <div className="mt-1">
              <input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                {...register('confirmPassword', { 
                  required: 'Please confirm your password',
                  validate: value => value === password || 'Passwords do not match'
                })}
              />
              {errors.confirmPassword && (
                <p className="mt-1 text-sm text-red-600">{errors.confirmPassword.message as string}</p>
              )}
            </div>
          </div>

          {/* Profile Picture Upload — Students Only */}
          {role === 'student' && (
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload Profile Picture
              </label>
              <p className="text-xs text-gray-500 mb-3">
                Used for face recognition verification during quizzes. Accepts JPG or PNG (max 5MB).
              </p>

              {profilePreview ? (
                <div className="flex items-center gap-4">
                  <img
                    src={profilePreview}
                    alt="Profile preview"
                    className="h-24 w-24 rounded-full object-cover border-2 border-primary-300 shadow-sm"
                  />
                  <div className="flex flex-col gap-2">
                    <p className="text-sm text-gray-700 font-medium">{profileFile?.name}</p>
                    <p className="text-xs text-gray-500">
                      {profileFile ? `${(profileFile.size / 1024).toFixed(1)} KB` : ''}
                    </p>
                    {extractingFace && (
                      <p className="text-xs text-blue-600 animate-pulse">Analyzing face...</p>
                    )}
                    {faceEncoding && (
                      <p className="text-xs text-green-600 flex items-center gap-1">
                        <CheckCircleIcon className="h-4 w-4" /> Face detected
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={removeProfilePicture}
                      className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700 font-medium"
                    >
                      <XMarkIcon className="h-4 w-4" /> Remove
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-primary-400 hover:bg-primary-50 transition-colors"
                >
                  <CameraIcon className="h-8 w-8 text-gray-400 mb-1" />
                  <span className="text-sm text-gray-500">Click to upload a photo</span>
                  <span className="text-xs text-gray-400">JPG or PNG, max 5MB</span>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png"
                onChange={handleFileSelect}
                className="hidden"
              />

              {pictureError && (
                <p className="mt-2 text-sm text-red-600">{pictureError}</p>
              )}
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
            >
              {isLoading ? 'Creating account...' : 'Create account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RegisterPage;

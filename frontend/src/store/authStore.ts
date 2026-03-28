import { create } from 'zustand';
import api from '../services/api';
import { User } from '../types';

interface FaceVerificationPending {
  tempToken: string;
  userName: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isAuthChecking: boolean;
  error: string | null;
  faceVerificationPending: FaceVerificationPending | null;
  
  login: (credentials: any) => Promise<void>;
  verifyFaceLogin: (faceEncoding: number[]) => Promise<void>;
  cancelFaceVerification: () => void;
  register: (data: any) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
  switchRole: (role: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, _get) => ({
  user: null,
  token: localStorage.getItem('token'),
  isAuthenticated: !!localStorage.getItem('token'),
  isLoading: false,
  isAuthChecking: true, // Start as true to prevent flash
  error: null,
  faceVerificationPending: null,

  login: async (credentials) => {
    set({ isLoading: true, error: null, faceVerificationPending: null });
    try {
      const response = await api.post<any>('/auth/login', credentials);
      const responseData = response.data.data;
      console.log('[AuthStore.login] Raw API response data:', JSON.stringify(responseData, null, 2));

      if (responseData.requiresFaceVerification) {
        console.log('[AuthStore.login] Face verification REQUIRED — switching to camera step');
        set({
          isLoading: false,
          faceVerificationPending: {
            tempToken: responseData.tempToken,
            userName: responseData.userName,
          },
        });
        return;
      }

      console.log('[AuthStore.login] No face verification needed — issuing token directly');
      const user = responseData.user || responseData;
      const token = responseData.token;
      localStorage.setItem('token', token);
      set({ user, token, isAuthenticated: true, isLoading: false, error: null });
    } catch (error: any) {
      const message = error.response?.data?.message || error.response?.data?.error?.message || 'Login failed';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  verifyFaceLogin: async (faceEncoding: number[]) => {
    const pending = _get().faceVerificationPending;
    if (!pending) throw new Error('No face verification pending');

    set({ isLoading: true, error: null });
    try {
      const response = await api.post<any>('/auth/verify-face-login', {
        tempToken: pending.tempToken,
        faceEncoding,
      });
      const { user, token } = response.data.data;
      localStorage.setItem('token', token);
      set({ user, token, isAuthenticated: true, isLoading: false, faceVerificationPending: null, error: null });
    } catch (error: any) {
      const message = error.response?.data?.message || error.response?.data?.error?.message || 'Face verification failed';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  cancelFaceVerification: () => {
    set({ faceVerificationPending: null, error: null });
  },

  register: async (data) => {
    set({ isLoading: true, error: null });
    try {
      // Increase timeout for registration with image upload
      await api.post<any>('/auth/register', data, {
        timeout: 30000,
        maxBodyLength: 10 * 1024 * 1024,
        maxContentLength: 10 * 1024 * 1024,
      });
      // Do NOT auto-login — user must go through /login (including face verification for students)
      set({ isLoading: false, error: null });
    } catch (error: any) {
      const message = error.response?.data?.message || error.response?.data?.error?.message || 'Registration failed';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  logout: () => {
    localStorage.removeItem('token');
    set({ user: null, token: null, isAuthenticated: false, isAuthChecking: false });
  },

  checkAuth: async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      set({ isAuthenticated: false, user: null, isAuthChecking: false });
      return;
    }

    // Don't set isLoading, use separate isAuthChecking
    try {
      const response = await api.get<any>('/auth/me');
      set({ user: response.data.data, isAuthenticated: true, isAuthChecking: false });
    } catch (error) {
      localStorage.removeItem('token');
      set({ user: null, token: null, isAuthenticated: false, isAuthChecking: false });
    }
  },

  updateProfile: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.put<any>('/auth/profile', data);
      set({ user: response.data.data, isLoading: false });
    } catch (error: any) {
      const message = error.response?.data?.error?.message || 'Update failed';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  switchRole: async (role) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.put<any>('/auth/switch-role', { role });
      const { user, token } = response.data.data;
      localStorage.setItem('token', token);
      set({ user, token, isLoading: false });
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to switch role';
      set({ error: message, isLoading: false });
      throw error;
    }
  },
}));

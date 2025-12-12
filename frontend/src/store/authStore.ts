import { create } from 'zustand';
import api from '../services/api';
import { User } from '../types';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isAuthChecking: boolean;
  error: string | null;
  
  login: (credentials: any) => Promise<void>;
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

  login: async (credentials) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post<any>('/auth/login', credentials);
      const responseData = response.data.data;
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

  register: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post<any>('/auth/register', data);
      const responseData = response.data.data;
      const user = responseData.user || responseData;
      const token = responseData.token;
      
      localStorage.setItem('token', token);
      set({ user, token, isAuthenticated: true, isLoading: false, error: null });
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

import { create } from "zustand";
import api from "../services/api";
import { User } from "../types";

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isAuthChecking: boolean;
  error: string | null;

  login: (credentials: any) => Promise<void>;
  register: (data: any) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<string>;
  resetPassword: (token: string, password: string) => Promise<string>;
  logout: () => void;
  checkAuth: () => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem("token"),
  isAuthenticated: !!localStorage.getItem("token"),
  isLoading: false,
  isAuthChecking: true, // Start as true to prevent flash
  error: null,

  login: async (credentials) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post<any>("/auth/login", credentials);
      const responseData = response.data.data;

      const user = responseData.user || responseData;
      const token = responseData.token;
      localStorage.setItem("token", token);
      set({
        user,
        token,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (error: any) {
      const message =
        error.response?.data?.message ||
        error.response?.data?.error?.message ||
        "Login failed";
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  register: async (data) => {
    set({ isLoading: true, error: null });
    try {
      await api.post<any>("/auth/register", data, {
        timeout: 30000,
        maxBodyLength: 10 * 1024 * 1024,
        maxContentLength: 10 * 1024 * 1024,
      });
      // Sign in separately after registration.
      set({ isLoading: false, error: null });
    } catch (error: any) {
      const message =
        error.response?.data?.message ||
        error.response?.data?.error?.message ||
        "Registration failed";
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  requestPasswordReset: async (email) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post<any>("/auth/forgot-password", { email });
      const message =
        response.data.data?.message ||
        "If an account with that email exists, a password reset link has been sent.";
      set({ isLoading: false, error: null });
      return message;
    } catch (error: any) {
      const message =
        error.response?.data?.message ||
        error.response?.data?.error?.message ||
        "Failed to send reset email";
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  resetPassword: async (token, password) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post<any>("/auth/reset-password", {
        token,
        password,
      });
      const message =
        response.data.data?.message || "Password reset successful.";
      set({ isLoading: false, error: null });
      return message;
    } catch (error: any) {
      const message =
        error.response?.data?.message ||
        error.response?.data?.error?.message ||
        "Failed to reset password";
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  logout: () => {
    const token = localStorage.getItem("token");
    if (token)
      void api
        .post(
          "/auth/logout",
          {},
          { headers: { Authorization: `Bearer ${token}` } },
        )
        .catch(() => {
          /* Local logout still completes when offline. */
        });
    localStorage.removeItem("token");
    sessionStorage.removeItem("currentQuiz");
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      isAuthChecking: false,
      error: null,
    });
  },

  checkAuth: async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      set({ isAuthenticated: false, user: null, isAuthChecking: false });
      return;
    }

    // Don't set isLoading, use separate isAuthChecking
    try {
      const response = await api.get<any>("/auth/me");
      set({
        user: response.data.data,
        isAuthenticated: true,
        isAuthChecking: false,
      });
    } catch (error) {
      localStorage.removeItem("token");
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        isAuthChecking: false,
      });
    }
  },

  updateProfile: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.put<any>("/auth/profile", data);
      set({ user: response.data.data, isLoading: false });
    } catch (error: any) {
      const message = error.response?.data?.error?.message || "Update failed";
      set({ error: message, isLoading: false });
      throw error;
    }
  },
}));

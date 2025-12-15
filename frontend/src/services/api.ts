import axios from 'axios';

// Create axios instance
const api = axios.create({
  // In dev we proxy /api -> http://localhost:5000 via vite.config.ts.
  // In prod, we strictly use the Vercel backend.
  baseURL: import.meta.env.PROD
    ? 'https://quiz-shield.vercel.app/api'
    : (import.meta.env.VITE_API_URL ?? '/api'),
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor to attach the token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add a response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle 401 Unauthorized (token expired or invalid)
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      window.location.href = `${import.meta.env.BASE_URL}login`;
    }
    return Promise.reject(error);
  }
);

export default api;

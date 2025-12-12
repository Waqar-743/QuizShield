import { useState, useCallback } from 'react';
import api from '../services/api';
import { Analytics } from '../types';

export const useAnalytics = () => {
  const [stats, setStats] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardStats = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/analytics/dashboard');
      setStats(response.data.data);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to fetch stats');
    } finally {
      setLoading(false);
    }
  }, []);

  return { stats, loading, error, fetchDashboardStats };
};

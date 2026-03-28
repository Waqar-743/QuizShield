import { useState, useCallback } from 'react';
import api from '../services/api';
import { Course, Topic } from '../types';
import toast from 'react-hot-toast';

export const useCourses = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [currentCourse, setCurrentCourse] = useState<Course | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });

  const fetchCourses = useCallback(async (params?: any) => {
    setLoading(true);
    try {
      const response = await api.get('/courses', { params });
      setCourses(response.data.data);
      setPagination(response.data.pagination);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to fetch courses');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCourseById = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const response = await api.get(`/courses/${id}`);
      setCurrentCourse(response.data.data);
      
      // Also fetch topics
      const topicsResponse = await api.get(`/courses/${id}/topics`);
      setTopics(topicsResponse.data.data);
      
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to fetch course details');
    } finally {
      setLoading(false);
    }
  }, []);

  const enrollInCourse = useCallback(async (courseId: string) => {
    setLoading(true);
    try {
      await api.post(`/courses/${courseId}/enroll`);
      toast.success('Enrolled successfully!');
      // Refresh course data
      await fetchCourseById(courseId);
    } catch (err: any) {
      const message = err.response?.data?.error?.message || 'Failed to enroll';
      toast.error(message);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [fetchCourseById]);

  const fetchEnrolledCourses = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/courses/my/enrolled');
      setCourses(response.data.data);
      setPagination(response.data.pagination);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to fetch enrolled courses');
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    courses,
    currentCourse,
    topics,
    loading,
    error,
    pagination,
    fetchCourses,
    fetchCourseById,
    enrollInCourse,
    fetchEnrolledCourses,
  };
};

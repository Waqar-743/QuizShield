import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';

// Layouts
import MainLayout from './components/layout/MainLayout';
import AuthLayout from './components/layout/AuthLayout';
import { DashboardLayout } from './components/shared';

// Route Guards
import { StudentRoute, TeacherRoute } from './components/routes';

// Pages
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import CoursesPage from './pages/courses/CoursesPage';
import CourseDetailPage from './pages/courses/CourseDetailPage';
import TopicPage from './pages/courses/TopicPage';
import QuizStartPage from './pages/quiz/QuizStartPage';
import QuizPage from './pages/quiz/QuizPage';
import QuizResultsPage from './pages/quiz/QuizResultsPage';
import AccessByCodePage from './pages/quiz/AccessByCodePage';
import QuizTakePage from './pages/quiz/QuizTakePage';
import TeacherQuizResultsPage from './pages/quiz/TeacherQuizResultsPage';
import AnalyticsPage from './pages/analytics/AnalyticsPage';
import ProfilePage from './pages/profile/ProfilePage';
import CreateQuestionPage from './pages/dashboard/CreateQuestionPage';
import NotFoundPage from './pages/NotFoundPage';

// Student Dashboard Pages
import {
  StudentOverview,
  StudentCourses,
  StudentQuizHistory,
  StudentRecommendations,
  JoinQuizPage,
} from './pages/dashboard/student';

// Teacher Dashboard Pages
import {
  TeacherOverview,
  TeacherCourses,
  TeacherTopics,
  TeacherQuestions,
  TeacherAnalytics,
  CreateCoursePage,
  TeacherQuizzes,
  TeacherSubmissions,
} from './pages/dashboard/teacher';

// Protected Route Component
const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const { isAuthenticated, isAuthChecking } = useAuthStore();
  
  if (isAuthChecking) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
};

// Guest Route Component (redirect to dashboard if already logged in)
const GuestRoute = ({ children }: { children: JSX.Element }) => {
  const { isAuthenticated, isAuthChecking, user } = useAuthStore();
  
  if (isAuthChecking) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }
  
  if (isAuthenticated) {
    // Redirect to role-specific dashboard
    if (user?.role === 'teacher') {
      return <Navigate to="/dashboard/teacher" replace />;
    }
    return <Navigate to="/dashboard/student" replace />;
  }
  
  return children;
};

// Role-based dashboard redirect
const DashboardRedirect = () => {
  const { user } = useAuthStore();
  
  if (user?.role === 'teacher' || user?.role === 'admin') {
    return <Navigate to="/dashboard/teacher" replace />;
  }
  return <Navigate to="/dashboard/student" replace />;
};

function App() {
  const { checkAuth } = useAuthStore();

  // Check auth on app mount
  useEffect(() => {
    checkAuth();
  }, []);

  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<LandingPage />} />
      
      {/* Auth Routes - redirect if already authenticated */}
      <Route element={
        <GuestRoute>
          <AuthLayout />
        </GuestRoute>
      }>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>
      
      {/* Protected Routes */}
      <Route element={
        <ProtectedRoute>
          <MainLayout />
        </ProtectedRoute>
      }>
        <Route path="/dashboard" element={<DashboardRedirect />} />
        <Route path="/dashboard-old" element={<DashboardPage />} />
        <Route path="/courses" element={<CoursesPage />} />
        <Route path="/courses/:courseId" element={<CourseDetailPage />} />
        <Route path="/courses/:courseId/topics/:topicId" element={<TopicPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/profile" element={<ProfilePage />} />
      </Route>

      {/* Student Dashboard Routes */}
      <Route element={<StudentRoute />}>
        <Route path="/dashboard/student" element={<DashboardLayout role="student" />}>
          <Route index element={<StudentOverview />} />
          <Route path="join-quiz" element={<JoinQuizPage />} />
          <Route path="quiz-history" element={<StudentQuizHistory />} />
          <Route path="courses" element={<StudentCourses />} />
          <Route path="recommendations" element={<StudentRecommendations />} />
        </Route>
      </Route>

      {/* Teacher Dashboard Routes */}
      <Route element={<TeacherRoute />}>
        <Route path="/dashboard/teacher" element={<DashboardLayout role="teacher" />}>
          <Route index element={<TeacherOverview />} />
          <Route path="quizzes" element={<TeacherQuizzes />} />
          <Route path="submissions" element={<TeacherSubmissions />} />
          <Route path="analytics" element={<TeacherAnalytics />} />
          <Route path="courses" element={<TeacherCourses />} />
          <Route path="courses/new" element={<CreateCoursePage />} />
          <Route path="topics" element={<TeacherTopics />} />
          <Route path="questions" element={<TeacherQuestions />} />
        </Route>
      </Route>
      
      {/* Quiz Routes (Full Screen) */}
      <Route path="/quiz/start/:topicId" element={
        <ProtectedRoute>
          <QuizStartPage />
        </ProtectedRoute>
      } />
      <Route path="/quiz/:quizId/attempt/:attemptId" element={
        <ProtectedRoute>
          <QuizPage />
        </ProtectedRoute>
      } />
      <Route path="/quiz/results/:attemptId" element={
        <ProtectedRoute>
          <QuizResultsPage />
        </ProtectedRoute>
      } />
      <Route path="/quiz/access-by-code" element={
        <ProtectedRoute>
          <AccessByCodePage />
        </ProtectedRoute>
      } />
      <Route path="/quiz/take/:attemptId" element={
        <ProtectedRoute>
          <QuizTakePage />
        </ProtectedRoute>
      } />
      <Route path="/quiz/teacher-results/:attemptId" element={
        <ProtectedRoute>
          <TeacherQuizResultsPage />
        </ProtectedRoute>
      } />

      {/* Question Creation Route */}
      <Route path="/dashboard/teacher/courses/:courseId/topics/:topicId/create-question" element={
        <ProtectedRoute>
          <CreateQuestionPage />
        </ProtectedRoute>
      } />
      
      {/* 404 */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default App;

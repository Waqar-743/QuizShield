import { useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';

// Layouts
import MainLayout from './components/layout/MainLayout';
import AuthLayout from './components/layout/AuthLayout';
import { DashboardLayout } from './components/shared';

// Route Guards
import { StudentRoute, TeacherRoute } from './components/routes';

// Lazy-loaded pages to reduce initial bundle size
const LandingPage = lazy(() => import('./pages/LandingPage'));
const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage'));
const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage'));
const CoursesPage = lazy(() => import('./pages/courses/CoursesPage'));
const CourseDetailPage = lazy(() => import('./pages/courses/CourseDetailPage'));
const TopicPage = lazy(() => import('./pages/courses/TopicPage'));
const QuizStartPage = lazy(() => import('./pages/quiz/QuizStartPage'));
const QuizPage = lazy(() => import('./pages/quiz/QuizPage'));
const QuizResultsPage = lazy(() => import('./pages/quiz/QuizResultsPage'));
const AccessByCodePage = lazy(() => import('./pages/quiz/AccessByCodePage'));
const QuizTakePage = lazy(() => import('./pages/quiz/QuizTakePage'));
const TeacherQuizResultsPage = lazy(() => import('./pages/quiz/TeacherQuizResultsPage'));
const AnalyticsPage = lazy(() => import('./pages/analytics/AnalyticsPage'));
const ProfilePage = lazy(() => import('./pages/profile/ProfilePage'));
const CreateQuestionPage = lazy(() => import('./pages/dashboard/CreateQuestionPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

const StudentOverview = lazy(() => import('./pages/dashboard/student/StudentOverview'));
const StudentCourses = lazy(() => import('./pages/dashboard/student/StudentCourses'));
const StudentQuizHistory = lazy(() => import('./pages/dashboard/student/StudentQuizHistory'));
const StudentRecommendations = lazy(() => import('./pages/dashboard/student/StudentRecommendations'));
const JoinQuizPage = lazy(() => import('./pages/dashboard/student/JoinQuizPage'));

const TeacherOverview = lazy(() => import('./pages/dashboard/teacher/TeacherOverview'));
const TeacherCourses = lazy(() => import('./pages/dashboard/teacher/TeacherCourses'));
const TeacherTopics = lazy(() => import('./pages/dashboard/teacher/TeacherTopics'));
const TeacherQuestions = lazy(() => import('./pages/dashboard/teacher/TeacherQuestions'));
const TeacherAnalytics = lazy(() => import('./pages/dashboard/teacher/TeacherAnalytics'));
const CreateCoursePage = lazy(() => import('./pages/dashboard/teacher/CreateCoursePage'));
const TeacherQuizzes = lazy(() => import('./pages/dashboard/teacher/TeacherQuizzes'));
const TeacherSubmissions = lazy(() => import('./pages/dashboard/teacher/TeacherSubmissions'));

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
    <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading page...</div>}>
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
    </Suspense>
  );
}

export default App;

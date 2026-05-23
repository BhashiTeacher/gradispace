import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { PageSpinner } from './components/UI/Spinner';
import AppShell from './components/Layout/AppShell';

// Auth pages
import Login          from './pages/auth/Login';
import Signup         from './pages/auth/Signup';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword  from './pages/auth/ResetPassword';

// Dashboard pages
import Dashboard   from './pages/dashboard/Dashboard';
import ExamBuilder from './pages/exams/ExamBuilder';
import QuestionBank from './pages/questions/QuestionBank';
import Classrooms  from './pages/classrooms/Classrooms';
import Results     from './pages/results/Results';
import Billing     from './pages/billing/Billing';
import Settings    from './pages/settings/Settings';

// Student pages (public)
import ExamPage  from './pages/student/ExamPage';
import GroupPage from './pages/student/GroupPage';

// 404
import NotFound from './pages/NotFound';

function RequireAuth({ children }) {
  const { teacher, loading } = useAuth();
  const location = useLocation();
  if (loading) return <PageSpinner />;
  if (!teacher) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}

function RequireGuest({ children }) {
  const { teacher, loading } = useAuth();
  if (loading) return <PageSpinner />;
  if (teacher) return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      {/* Root redirect */}
      <Route index element={<Navigate to="/dashboard" replace />} />

      {/* Guest-only auth routes */}
      <Route path="/login"            element={<RequireGuest><Login /></RequireGuest>} />
      <Route path="/signup"           element={<RequireGuest><Signup /></RequireGuest>} />
      <Route path="/forgot-password"  element={<RequireGuest><ForgotPassword /></RequireGuest>} />
      <Route path="/reset-password"   element={<RequireGuest><ResetPassword /></RequireGuest>} />

      {/* Protected teacher dashboard */}
      <Route path="/" element={<RequireAuth><AppShell /></RequireAuth>}>
        <Route path="dashboard"  element={<Dashboard />} />
        <Route path="exams/new"  element={<ExamBuilder />} />
        <Route path="exams/:id"  element={<ExamBuilder />} />
        <Route path="questions"  element={<QuestionBank />} />
        <Route path="classrooms" element={<Classrooms />} />
        <Route path="results"    element={<Results />} />
        <Route path="billing"    element={<Billing />} />
        <Route path="settings"   element={<Settings />} />
      </Route>

      {/* Public student pages */}
      <Route path="/e/:token" element={<ExamPage />} />
      <Route path="/g/:token" element={<GroupPage />} />

      {/* 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

import { lazy, Suspense, useContext } from 'react';
import { AnimatePresence } from 'framer-motion';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthContext, AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { ThemeProvider } from './context/ThemeContext';

const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const DriverDashboard = lazy(() => import('./pages/DriverDashboard'));
const DriverAnalytics = lazy(() => import('./pages/DriverAnalytics'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Login = lazy(() => import('./pages/Login'));
const Profile = lazy(() => import('./pages/Profile'));
const Rides = lazy(() => import('./pages/Rides'));
const RoleSelection = lazy(() => import('./pages/RoleSelection'));
const Settings = lazy(() => import('./pages/Settings'));
const Signup = lazy(() => import('./pages/Signup'));

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 text-sm text-slate-300">
      Loading RideFlow...
    </div>
  );
}

function RoleAwareRedirect({ type }) {
  const { user } = useContext(AuthContext);

  if (!user?.role) {
    return <Navigate to="/" replace />;
  }

  const destinations = {
    customer: {
      profile: '/dashboard/customer/profile',
      settings: '/dashboard/customer/settings',
    },
    driver: {
      profile: '/dashboard/driver/analytics',
      settings: '/dashboard/driver/settings',
    },
    admin: {
      profile: '/dashboard/admin/profile',
      settings: '/dashboard/admin/settings',
    },
  };

  const destination = destinations[user.role]?.[type] || '/';

  return <Navigate to={destination} replace />;
}

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Suspense fallback={<RouteFallback />}>
        <Routes location={location} key={location.pathname + location.search}>
          <Route path="/" element={<RoleSelection />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route
            path="/profile"
            element={(
              <ProtectedRoute>
                <RoleAwareRedirect type="profile" />
              </ProtectedRoute>
            )}
          />
          <Route
            path="/settings"
            element={(
              <ProtectedRoute>
                <RoleAwareRedirect type="settings" />
              </ProtectedRoute>
            )}
          />
          <Route
            path="/dashboard/customer"
            element={(
              <ProtectedRoute roleRequired="customer">
                <Dashboard />
              </ProtectedRoute>
            )}
          />
          <Route
            path="/dashboard/customer/rides"
            element={(
              <ProtectedRoute roleRequired="customer">
                <Rides />
              </ProtectedRoute>
            )}
          />
          <Route
            path="/dashboard/customer/analytics"
            element={(
              <ProtectedRoute roleRequired="customer">
                <Analytics />
              </ProtectedRoute>
            )}
          />
          <Route
            path="/user/analytics"
            element={(
              <ProtectedRoute roleRequired="customer">
                <Navigate to="/dashboard/customer/analytics" replace />
              </ProtectedRoute>
            )}
          />
          <Route
            path="/dashboard/customer/profile"
            element={(
              <ProtectedRoute roleRequired="customer">
                <Profile />
              </ProtectedRoute>
            )}
          />
          <Route
            path="/dashboard/customer/settings"
            element={(
              <ProtectedRoute roleRequired="customer">
                <Settings />
              </ProtectedRoute>
            )}
          />
          <Route
            path="/dashboard/driver"
            element={(
              <ProtectedRoute roleRequired="driver">
                <DriverDashboard />
              </ProtectedRoute>
            )}
          />
          <Route
            path="/dashboard/driver/rides"
            element={(
              <ProtectedRoute roleRequired="driver">
                <Rides />
              </ProtectedRoute>
            )}
          />
          <Route
            path="/dashboard/driver/analytics"
            element={(
              <ProtectedRoute roleRequired="driver">
                <DriverAnalytics />
              </ProtectedRoute>
            )}
          />
          <Route
            path="/driver/analytics"
            element={(
              <ProtectedRoute roleRequired="driver">
                <Navigate to="/dashboard/driver/analytics" replace />
              </ProtectedRoute>
            )}
          />
          <Route
            path="/dashboard/driver/settings"
            element={(
              <ProtectedRoute roleRequired="driver">
                <Settings />
              </ProtectedRoute>
            )}
          />
          <Route
            path="/dashboard/admin"
            element={(
              <ProtectedRoute roleRequired="admin">
                <AdminDashboard />
              </ProtectedRoute>
            )}
          />
          <Route
            path="/dashboard/admin/rides"
            element={(
              <ProtectedRoute roleRequired="admin">
                <Rides />
              </ProtectedRoute>
            )}
          />
          <Route
            path="/dashboard/admin/profile"
            element={(
              <ProtectedRoute roleRequired="admin">
                <Profile />
              </ProtectedRoute>
            )}
          />
          <Route
            path="/dashboard/admin/settings"
            element={(
              <ProtectedRoute roleRequired="admin">
                <Settings />
              </ProtectedRoute>
            )}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SocketProvider>
          <BrowserRouter>
            <AnimatedRoutes />
          </BrowserRouter>
        </SocketProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

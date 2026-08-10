import { useContext } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import SkeletonBlock from './SkeletonBlock';

export default function ProtectedRoute({ children, roleRequired }) {
  const { user, token, isLoading } = useContext(AuthContext);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <SkeletonBlock className="h-24 w-full" />
          <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-6">
              <SkeletonBlock className="h-[420px] w-full" />
              <SkeletonBlock className="h-48 w-full" />
            </div>
            <SkeletonBlock className="h-[620px] w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!token || !user) {
    const nextRole = roleRequired || 'customer';
    return <Navigate to={`/login?role=${nextRole}`} replace />;
  }

  if (roleRequired && user.role !== roleRequired) {
    return <Navigate to={`/dashboard/${user.role}`} replace />;
  }

  return children || <Outlet />;
}

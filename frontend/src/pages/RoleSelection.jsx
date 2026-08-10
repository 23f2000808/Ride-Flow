import { useContext, useMemo, useState } from 'react';
import { CarFront, LayoutDashboard, LogOut, ShieldCheck, UserRound } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import RoleCard from '../components/RoleCard';
import { AuthContext } from '../context/AuthContext';

const roles = [
  {
    key: 'customer',
    title: 'Customer',
    description: 'Book rides, track arrivals in real time, and move through the city with a polished premium experience.',
    icon: UserRound,
    accent: 'radial-gradient(circle at top, rgba(34,211,238,0.35), transparent 65%)',
  },
  {
    key: 'driver',
    title: 'Driver',
    description: 'Manage ride requests, stay online, and handle pickups with a high-clarity operations workflow.',
    icon: CarFront,
    accent: 'radial-gradient(circle at top, rgba(14,165,233,0.35), transparent 65%)',
  },
  {
    key: 'admin',
    title: 'Admin',
    description: 'Review platform activity, monitor operations, and oversee users, drivers, and ride movement.',
    icon: ShieldCheck,
    accent: 'radial-gradient(circle at top, rgba(129,140,248,0.35), transparent 65%)',
  },
];

export default function RoleSelection() {
  const navigate = useNavigate();
  const { user, displayName, logout } = useContext(AuthContext);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const dashboardHref = useMemo(() => {
    if (user?.role === 'driver') return '/dashboard/driver';
    if (user?.role === 'admin') return '/dashboard/admin';
    if (user?.role === 'customer') return '/dashboard/customer';
    return '/';
  }, [user?.role]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      navigate('/');
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <motion.main
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="theme-auth-shell relative isolate min-h-screen overflow-hidden px-4 py-10 sm:px-6 lg:px-10"
    >
      <div className="aurora-bg" />
      <div className="auth-mesh" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.12),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(99,102,241,0.16),transparent_30%)]" />
      <div className="dashboard-orb left-[4%] top-[12%] h-56 w-56 bg-cyan-300/12" />
      <div className="dashboard-orb right-[8%] top-[18%] h-64 w-64 bg-indigo-300/10" />

      <section className="relative mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-7xl flex-col items-center justify-center">
        {user ? (
          <motion.div
            initial={{ opacity: 0, y: -18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="theme-panel theme-border mb-8 flex w-full max-w-5xl flex-col gap-4 rounded-[28px] px-5 py-4 shadow-[0_24px_80px_rgba(2,6,23,0.14)] sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="theme-label text-xs uppercase tracking-[0.24em]">Signed In</p>
              <p className="theme-heading mt-2 text-lg font-semibold">{displayName || user.email}</p>
              <p className="theme-copy mt-1 text-sm">
                You are currently in the {user.role} workspace. You can return to your dashboard or log out from here.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => navigate(dashboardHref)}
                className="theme-secondary-button inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-5 text-sm font-semibold"
              >
                <LayoutDashboard className="h-4 w-4" />
                Open dashboard
              </button>
              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-white/80 px-5 text-sm font-semibold text-rose-600 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-300/20 dark:bg-white/5 dark:text-rose-200"
              >
                <LogOut className="h-4 w-4" />
                {isLoggingOut ? 'Logging out...' : 'Logout'}
              </button>
            </div>
          </motion.div>
        ) : null}

        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto max-w-3xl text-center"
        >
          <span className="theme-badge inline-flex items-center rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.32em] shadow-[0_16px_40px_rgba(34,211,238,0.08)]">
            RideFlow Access
          </span>
          <h1 className="theme-heading mt-6 text-4xl font-semibold tracking-[-0.065em] sm:text-5xl lg:text-7xl">
            Choose the workspace that fits your momentum.
          </h1>
          <p className="theme-copy mx-auto mt-5 max-w-2xl text-base leading-8 sm:text-lg">
            A premium, role-aware gateway for riders, drivers, and operators with smooth transitions, tactile cards, and a refined product feel from the first click.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.08 }}
          className="theme-panel theme-border mt-8 grid w-full max-w-5xl gap-3 rounded-[30px] p-4 backdrop-blur-2xl sm:grid-cols-3"
        >
          {[
            ['Real-time auth', 'JWT sessions with role-aware redirects'],
            ['Premium motion', 'Smooth transitions, glow, and tactile hover feedback'],
            ['Unified design', 'One visual system across entry, auth, and dashboards'],
          ].map(([label, text]) => (
            <div key={label} className="theme-soft-card rounded-[22px] px-4 py-4 text-left">
              <p className="theme-label text-xs uppercase tracking-[0.24em]">{label}</p>
              <p className="theme-copy mt-2 text-sm leading-6">{text}</p>
            </div>
          ))}
        </motion.div>

        <div className="mt-12 grid w-full gap-5 md:grid-cols-3">
          {roles.map((role, index) => (
            <RoleCard
              key={role.key}
              icon={role.icon}
              title={role.title}
              description={role.description}
              accent={role.accent}
              delay={0.12 + index * 0.1}
              onSelect={() => navigate(`/login?role=${role.key}`)}
            />
          ))}
        </div>
      </section>
    </motion.main>
  );
}

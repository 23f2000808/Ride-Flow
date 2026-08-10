import { useContext, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import Navbar from './Navbar';
import { AuthContext } from '../../context/AuthContext';
import { ThemeContext } from '../../context/ThemeContext';

export default function CustomerShell({ children, toast, toastType = 'info', onDismissToast }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, displayName, logout } = useContext(AuthContext);
  const { isDark, toggleTheme } = useContext(ThemeContext);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [readNotifications, setReadNotifications] = useState([]);
  const role = user?.role || 'customer';

  const roleConfig = useMemo(() => {
    if (role === 'driver') {
      return {
        homeHref: '/dashboard/driver',
        workspaceLabel: 'Driver workspace',
        navItems: [
          { label: 'Dashboard', href: '/dashboard/driver' },
          { label: 'Rides', href: '/dashboard/driver/rides' },
          { label: 'Analytics', href: '/dashboard/driver/analytics' },
          { label: 'Settings', href: '/dashboard/driver/settings' },
        ],
        notifications: [
          {
            id: 'driver-rides',
            title: 'Ride history ready',
            body: 'Open your rides page to review completed, active, and rejected requests.',
            action: '/dashboard/driver/rides',
          },
          {
            id: 'driver-analytics',
            title: 'Driver analytics live',
            body: 'Open analytics to review ride totals, earnings, and distance performance.',
            action: '/dashboard/driver/analytics',
          },
          {
            id: 'driver-settings',
            title: 'Shift settings available',
            body: 'Manage notifications, theme, and security from one place.',
            action: '/dashboard/driver/settings',
          },
        ],
      };
    }

    if (role === 'admin') {
      return {
        homeHref: '/dashboard/admin',
        workspaceLabel: 'Admin workspace',
        navItems: [
          { label: 'Dashboard', href: '/dashboard/admin' },
          { label: 'Rides', href: '/dashboard/admin/rides' },
          { label: 'Profile', href: '/dashboard/admin/profile' },
          { label: 'Settings', href: '/dashboard/admin/settings' },
        ],
        notifications: [
          {
            id: 'admin-rides',
            title: 'Platform rides available',
            body: 'Review platform-wide ride activity and status filters from the rides view.',
            action: '/dashboard/admin/rides',
          },
          {
            id: 'admin-profile',
            title: 'Admin profile synced',
            body: 'Your profile editor now matches the rest of the product.',
            action: '/dashboard/admin/profile',
          },
          {
            id: 'admin-settings',
            title: 'Operations settings ready',
            body: 'Update security preferences and password settings here.',
            action: '/dashboard/admin/settings',
          },
        ],
      };
    }

    return {
      homeHref: '/dashboard/customer',
      workspaceLabel: 'Customer workspace',
      navItems: [
        { label: 'Dashboard', href: '/dashboard/customer' },
        { label: 'Rides', href: '/dashboard/customer/rides' },
        { label: 'Analytics', href: '/dashboard/customer/analytics' },
        { label: 'Settings', href: '/dashboard/customer/settings' },
      ],
      notifications: [
        {
          id: 'customer-profile',
          title: 'Profile shortcuts are live',
          body: 'Open your account page to review personal details and update contact information.',
          action: '/dashboard/customer/profile',
        },
        {
          id: 'customer-settings',
          title: 'Security settings ready',
          body: 'Manage ride alerts, app preferences, and your password from the settings screen.',
          action: '/dashboard/customer/settings',
        },
        {
          id: 'customer-rides',
          title: 'Ride activity available',
          body: 'Check your latest bookings and trip history from the rides dashboard.',
          action: '/dashboard/customer/rides',
        },
      ],
    };
  }, [role]);

  const markNotificationRead = (id) => {
    setReadNotifications((current) => (current.includes(id) ? current : [...current, id]));
  };

  const handleNotificationAction = (id, href) => {
    markNotificationRead(id);
    setNotificationsOpen(false);
    navigate(href);
  };

  const notifications = useMemo(() => roleConfig.notifications.map((item) => ({
    ...item,
    read: readNotifications.includes(item.id),
    action: () => handleNotificationAction(item.id, item.action),
  })), [readNotifications, roleConfig.notifications]);

  const closeProfileMenu = () => {
    setProfileOpen(false);
  };

  useEffect(() => {
    if (!toast || !onDismissToast) return undefined;

    const timer = window.setTimeout(() => {
      onDismissToast();
    }, 3000);

    return () => window.clearTimeout(timer);
  }, [toast, onDismissToast]);

  const profileMenu = [
    {
      label: role === 'driver' ? 'Analytics' : 'Profile',
      action: () => {
        closeProfileMenu();
        navigate(role === 'driver' ? '/dashboard/driver/analytics' : '/profile');
      },
    },
    {
      label: 'Settings',
      action: () => {
        closeProfileMenu();
        navigate('/settings');
      },
    },
    {
      label: 'Logout',
      action: async () => {
        closeProfileMenu();
        await logout();
        navigate('/');
      },
      tone: 'danger',
    },
  ];

  return (
    <motion.main initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="theme-shell relative isolate min-h-screen overflow-hidden px-4 py-8 sm:px-6 lg:px-8">
      <div className="aurora-bg" />
      <div className="dashboard-grid-glow" />
      <div className="dashboard-orb left-[4%] top-[10%] h-56 w-56 bg-cyan-300/14 dark:bg-cyan-300/14" />
      <div className="dashboard-orb right-[8%] top-[20%] h-64 w-64 bg-indigo-400/12 dark:bg-indigo-400/12" />

      <AnimatePresence>
        {toast ? (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            onClick={onDismissToast}
            className={`toast-premium fixed right-6 top-6 z-[1200] w-[320px] cursor-pointer rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${
              toastType === 'success'
                ? 'border border-emerald-200 bg-emerald-50 text-emerald-900 shadow-[0_18px_40px_rgba(16,185,129,0.16)] dark:border-emerald-500/25 dark:bg-emerald-600 dark:text-white'
                : toastType === 'error'
                  ? 'border border-rose-200 bg-rose-50 text-rose-900 shadow-[0_18px_40px_rgba(244,63,94,0.14)] dark:border-rose-500/25 dark:bg-red-600 dark:text-white'
                  : 'border border-sky-200 bg-white/98 text-slate-900 shadow-[0_18px_40px_rgba(37,99,235,0.12)] dark:border-white/10 dark:bg-slate-900 dark:text-white'
            }`}
          >
            {toast}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="theme-section-stack relative mx-auto max-w-7xl">
        <Navbar
          brand="RideFlow"
          workspaceLabel={roleConfig.workspaceLabel}
          homeHref={roleConfig.homeHref}
          navItems={roleConfig.navItems}
          currentPath={location.pathname}
          onNavigate={navigate}
          notifications={notifications}
          notificationsOpen={notificationsOpen}
          onToggleNotifications={(nextOpen) => {
            setNotificationsOpen((current) => (typeof nextOpen === 'boolean' ? nextOpen : !current));
            if (typeof nextOpen !== 'boolean' ? !notificationsOpen : nextOpen) {
              setProfileOpen(false);
            }
          }}
          profileOpen={profileOpen}
          onToggleProfile={(nextOpen) => {
            setProfileOpen((current) => (typeof nextOpen === 'boolean' ? nextOpen : !current));
            if (typeof nextOpen !== 'boolean' ? !profileOpen : nextOpen) {
              setNotificationsOpen(false);
            }
          }}
          profileMenu={profileMenu}
          userName={displayName}
          userEmail={user?.email}
          isDark={isDark}
          onToggleTheme={toggleTheme}
          onLogout={async () => {
            await logout();
            navigate('/');
          }}
        />

        {children}
      </div>
    </motion.main>
  );
}

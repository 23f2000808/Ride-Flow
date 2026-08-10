import { useEffect, useRef } from 'react';
import { Bell, ChevronDown, LogOut, MoonStar, Settings, SunMedium, UserCircle2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

export default function Navbar({
  brand,
  workspaceLabel = 'Workspace',
  homeHref = '/dashboard/customer',
  title,
  subtitle,
  navItems = [],
  currentPath,
  onNavigate,
  notifications = [],
  notificationsOpen,
  onToggleNotifications,
  profileOpen,
  onToggleProfile,
  profileMenu = [],
  userName,
  userEmail,
  isDark,
  onToggleTheme,
  onLogout,
}) {
  const notificationsRef = useRef(null);
  const profileRef = useRef(null);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (
        notificationsOpen
        && notificationsRef.current
        && !notificationsRef.current.contains(event.target)
      ) {
        onToggleNotifications(false);
      }

      if (profileOpen && profileRef.current && !profileRef.current.contains(event.target)) {
        onToggleProfile(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        if (notificationsOpen) onToggleNotifications(false);
        if (profileOpen) onToggleProfile(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [notificationsOpen, onToggleNotifications, profileOpen, onToggleProfile]);

  if (title && navItems.length === 0) {
    return (
      <motion.header
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="glass-shimmer relative overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.13),rgba(255,255,255,0.06))] px-6 py-5 shadow-[0_28px_90px_rgba(2,6,23,0.4)] backdrop-blur-3xl"
      >
        <div className="pointer-events-none absolute inset-0 rounded-[30px] bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.14),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(56,189,248,0.12),transparent_24%)]" />
        <div className="relative flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-cyan-200/75">RideFlow</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-[-0.06em] text-white">{title}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">{subtitle}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-[20px] border border-white/10 bg-white/8 px-4 py-3 shadow-[0_14px_35px_rgba(2,6,23,0.18)]">
              <p className="text-sm font-semibold text-white">{userName}</p>
              <p className="text-xs text-slate-400">{userEmail}</p>
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-[18px] bg-gradient-to-r from-cyan-300 via-sky-400 to-indigo-500 px-5 text-sm font-semibold text-slate-950 shadow-[0_18px_45px_rgba(56,189,248,0.28)] transition hover:-translate-y-0.5"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </div>
      </motion.header>
    );
  }

  return (
    <motion.header
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="glass-shimmer theme-navbar theme-border relative z-[1000] overflow-visible rounded-[30px] px-5 py-4"
    >
      <div className="pointer-events-none absolute inset-0 rounded-[30px] bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.08),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(56,189,248,0.06),transparent_24%)] dark:bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.14),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(56,189,248,0.12),transparent_24%)]" />
      <div className="relative flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => onNavigate(homeHref)} className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-[18px] border border-blue-100 bg-gradient-to-br from-blue-500 to-indigo-600 text-lg font-bold text-white shadow-[0_14px_35px_rgba(79,70,229,0.24)] dark:border-white/10 dark:from-cyan-300/18 dark:to-indigo-400/18">
              RF
            </div>
            <div className="text-left">
              <p className="theme-accent text-[11px] font-semibold uppercase tracking-[0.34em]">{brand}</p>
              <p className="theme-copy mt-1 text-sm">{workspaceLabel}</p>
            </div>
          </button>

          <nav className="theme-navbar-nav hidden items-center gap-2 rounded-[20px] p-2 lg:flex">
            {navItems.map((item) => {
              const active = currentPath === item.href;
              return (
                <button
                  key={item.href}
                  type="button"
                  onClick={() => onNavigate(item.href)}
                  className={`rounded-2xl px-4 py-2.5 text-sm font-semibold transition ${active ? 'theme-navbar-tab-active' : 'theme-navbar-tab'}`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onToggleTheme}
              className="theme-subtle theme-border inline-flex h-12 items-center justify-center gap-2 rounded-[18px] px-4 text-sm font-semibold shadow-[0_12px_30px_rgba(2,6,23,0.12)] hover:-translate-y-0.5"
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDark ? <SunMedium className="h-4.5 w-4.5" /> : <MoonStar className="h-4.5 w-4.5" />}
              <span className="hidden sm:inline">{isDark ? 'Light' : 'Dark'}</span>
            </button>

            <div ref={notificationsRef} className="relative">
              <button
                type="button"
                onClick={() => onToggleNotifications(!notificationsOpen)}
                className="theme-subtle theme-border flex h-12 w-12 items-center justify-center rounded-[18px] shadow-[0_12px_30px_rgba(2,6,23,0.12)] hover:-translate-y-0.5 hover:border-cyan-300/25 hover:text-cyan-500"
                aria-label="Toggle notifications"
                aria-expanded={notificationsOpen}
              >
                <Bell className="h-4.5 w-4.5" />
                {notifications.some((item) => !item.read) ? (
                  <span className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full bg-cyan-300" />
                ) : null}
              </button>

              <AnimatePresence>
                {notificationsOpen ? (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.98 }}
                    className="theme-popup absolute right-0 top-14 z-[1100] w-80 rounded-[24px] p-4 shadow-[0_22px_60px_var(--rf-shadow)]"
                  >
                    <p className="theme-accent text-[11px] font-semibold uppercase tracking-[0.3em]">Notifications</p>
                    {notifications.length ? (
                      <div className="mt-4 space-y-3">
                        {notifications.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={item.action}
                            className={`block w-full rounded-2xl border p-4 text-left transition ${
                              item.read
                                ? 'theme-soft-card'
                                : 'border-cyan-300/25 bg-cyan-400/10'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="theme-heading text-sm font-semibold">{item.title}</p>
                                <p className="theme-copy mt-2 text-sm leading-6">{item.body}</p>
                              </div>
                              {!item.read ? <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-cyan-300" /> : null}
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="theme-soft-card theme-copy mt-4 rounded-2xl p-4 text-sm">
                        No notifications right now.
                      </p>
                    )}
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>

            <button
              type="button"
              onClick={onLogout}
              className="theme-subtle theme-border inline-flex h-12 items-center justify-center gap-2 rounded-[18px] px-4 text-sm font-semibold shadow-[0_12px_30px_rgba(2,6,23,0.12)] hover:-translate-y-0.5 hover:border-rose-300/30 hover:text-rose-500"
              aria-label="Log out"
              title="Log out"
            >
              <LogOut className="h-4.5 w-4.5" />
              <span className="hidden md:inline">Logout</span>
            </button>

            <div ref={profileRef} className="relative">
              <div className="theme-subtle theme-border flex items-center rounded-[20px] shadow-[0_16px_40px_rgba(2,6,23,0.12)]">
                <button
                  type="button"
                  onClick={() => onNavigate('/profile')}
                  className="flex items-center gap-3 rounded-l-[20px] px-3 py-2.5 transition hover:border-cyan-300/20"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-300/30 to-indigo-400/25 text-sm font-semibold text-white">
                    {userName?.charAt(0)?.toUpperCase() || 'R'}
                  </div>
                  <div className="hidden min-w-0 text-left sm:block">
                    <p className="theme-heading truncate text-sm font-semibold">{userName}</p>
                    <p className="theme-copy truncate text-xs">{userEmail}</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => onToggleProfile(!profileOpen)}
                  className="flex h-full items-center justify-center self-stretch rounded-r-[20px] border-l border-white/10 px-3 text-slate-500 transition hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
                  aria-label="Toggle profile menu"
                  aria-expanded={profileOpen}
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>

              <AnimatePresence>
                {profileOpen ? (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.98 }}
                    className="theme-popup absolute right-0 top-14 z-[1100] w-56 rounded-[24px] p-3 shadow-[0_22px_60px_var(--rf-shadow)]"
                  >
                    {profileMenu.map((item) => (
                      <button
                        key={item.label}
                        type="button"
                        onClick={item.action}
                        className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-medium transition ${item.tone === 'danger' ? 'text-rose-500 hover:bg-rose-400/10' : 'theme-heading hover:bg-white/8 dark:hover:bg-white/8'}`}
                      >
                        {item.label === 'Profile' ? <UserCircle2 className="h-4 w-4" /> : item.label === 'Settings' ? <Settings className="h-4 w-4" /> : <LogOut className="h-4 w-4" />}
                        {item.label}
                      </button>
                    ))}
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      <div className="theme-navbar-nav relative mt-4 grid gap-2 rounded-[20px] p-2 lg:hidden sm:grid-cols-4">
        {navItems.map((item) => {
          const active = currentPath === item.href;
          return (
            <button
              key={item.href}
              type="button"
              onClick={() => onNavigate(item.href)}
              className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${active ? 'theme-navbar-tab-active' : 'theme-navbar-tab'}`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </motion.header>
  );
}

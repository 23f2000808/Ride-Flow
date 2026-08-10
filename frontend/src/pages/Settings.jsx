import { useContext, useEffect, useState } from 'react';
import { Bell, KeyRound, MoonStar, Save } from 'lucide-react';
import { motion } from 'framer-motion';
import CustomerShell from '../components/dashboard/CustomerShell';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import { apiFetch } from '../utils/api';

const PREFS_KEY = 'rideflow_customer_settings';

export default function Settings() {
  const { theme, setTheme } = useContext(ThemeContext);
  const { user } = useContext(AuthContext);
  const role = user?.role || 'customer';
  const [toast, setToast] = useState('');
  const [toastType, setToastType] = useState('success');
  const [prefs, setPrefs] = useState({ notifications: true, marketing: false, darkTheme: true });
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '' });
  const [isSavingPrefs, setIsSavingPrefs] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(PREFS_KEY);
    if (saved) {
      setPrefs(JSON.parse(saved));
    }
  }, []);

  useEffect(() => {
    setPrefs((current) => ({ ...current, darkTheme: theme === 'dark' }));
  }, [theme]);

  const savePreferences = async () => {
    setIsSavingPrefs(true);
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    setTheme(prefs.darkTheme ? 'dark' : 'light');
    setToastType('success');
    setToast('Settings saved successfully.');
    setIsSavingPrefs(false);
  };

  const savePassword = async () => {
    if (!passwords.currentPassword || !passwords.newPassword) {
      setToastType('error');
      setToast('Enter current and new password.');
      return;
    }

    if (passwords.newPassword.length < 8) {
      setToastType('error');
      setToast('New password must be at least 8 characters long.');
      return;
    }

    if (passwords.newPassword === passwords.currentPassword) {
      setToastType('error');
      setToast('New password must be different from the current password.');
      return;
    }

    setIsSavingPassword(true);
    try {
      await apiFetch('/users/password', {
        method: 'PATCH',
        body: JSON.stringify(passwords),
      });
      setPasswords({ currentPassword: '', newPassword: '' });
      setToastType('success');
      setToast('Password updated successfully.');
    } catch (error) {
      setToastType('error');
      setToast(error?.message || 'Unable to update password.');
    } finally {
      setIsSavingPassword(false);
    }
  };

  return (
    <CustomerShell toast={toast} toastType={toastType} onDismissToast={() => setToast('')}>
      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="theme-panel theme-border rounded-[34px] p-6 shadow-[0_24px_80px_rgba(2,6,23,0.16)] backdrop-blur-3xl">
          <p className="theme-accent text-[11px] font-semibold uppercase tracking-[0.34em]">Preferences</p>
          <h1 className="theme-heading mt-3 text-3xl font-semibold tracking-[-0.05em]">App settings</h1>
          <p className="theme-copy mt-3 max-w-2xl text-sm leading-7">
            Notification controls, theme mode, and security settings stay aligned across customer, driver, and admin workspaces.
          </p>
          <div className="mt-6 space-y-4">
            {[
              ['notifications', role === 'admin' ? 'Operations notifications' : role === 'driver' ? 'Dispatch notifications' : 'Ride notifications', role === 'admin' ? 'Receive approval, ride activity, and platform alerts.' : role === 'driver' ? 'Receive live request, trip, and shift updates.' : 'Receive live booking and ride status updates.', Bell],
              ['marketing', 'Product email', 'Get offers, new feature updates, and service announcements.', Bell],
              ['darkTheme', 'Dark theme', 'Use the premium dark interface across your current workspace.', MoonStar],
            ].map(([key, title, body, Icon]) => (
              <div key={key} className="theme-soft-card flex flex-col gap-4 rounded-[24px] p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="theme-subtle flex h-11 w-11 items-center justify-center rounded-2xl"><Icon className="h-4 w-4" /></div>
                  <div>
                    <p className="theme-heading text-sm font-semibold">{title}</p>
                    <p className="theme-copy mt-1 text-sm leading-6">{body}</p>
                  </div>
                </div>
                <label className="inline-flex cursor-pointer items-center self-end sm:self-auto">
                  <input
                    type="checkbox"
                    checked={prefs[key]}
                    onChange={() => setPrefs((current) => ({ ...current, [key]: !current[key] }))}
                    className="sr-only"
                  />
                  <span className={`flex h-7 w-12 items-center rounded-full p-1 transition ${prefs[key] ? 'bg-cyan-400/70' : 'bg-slate-400/20 dark:bg-white/12'}`}>
                    <span className={`h-5 w-5 rounded-full bg-white transition ${prefs[key] ? 'translate-x-5' : 'translate-x-0'}`} />
                  </span>
                </label>
              </div>
            ))}
          </div>
          <button type="button" onClick={savePreferences} disabled={isSavingPrefs} className="theme-primary-button mt-6 inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl px-6 text-sm font-semibold transition hover:-translate-y-0.5 disabled:opacity-60 sm:w-auto">
            <Save className="h-4 w-4" />
            {isSavingPrefs ? 'Saving...' : 'Save changes'}
          </button>
        </motion.section>

        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }} className="theme-panel theme-border rounded-[34px] p-6 shadow-[0_24px_80px_rgba(2,6,23,0.16)] backdrop-blur-3xl">
          <p className="theme-accent text-[11px] font-semibold uppercase tracking-[0.34em]">Security</p>
          <h2 className="theme-heading mt-3 text-2xl font-semibold tracking-[-0.04em]">Change password</h2>
          <p className="theme-copy mt-3 text-sm leading-7">
            Update your password securely. Both fields are validated before the request is sent.
          </p>
          <form
            className="mt-6 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              savePassword();
            }}
          >
            <label className="block">
              <span className="theme-label mb-2 block text-xs uppercase tracking-[0.24em]">Current password</span>
              <input type="password" autoComplete="current-password" value={passwords.currentPassword} onChange={(event) => setPasswords((current) => ({ ...current, currentPassword: event.target.value }))} className="theme-input h-14 w-full rounded-2xl px-4 text-sm outline-none" />
            </label>
            <label className="block">
              <span className="theme-label mb-2 block text-xs uppercase tracking-[0.24em]">New password</span>
              <input type="password" autoComplete="new-password" value={passwords.newPassword} onChange={(event) => setPasswords((current) => ({ ...current, newPassword: event.target.value }))} className="theme-input h-14 w-full rounded-2xl px-4 text-sm outline-none" />
            </label>
            <button type="submit" disabled={isSavingPassword} className="theme-secondary-button mt-6 inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl px-6 text-sm font-semibold transition hover:-translate-y-0.5 disabled:opacity-60 sm:w-auto">
              <KeyRound className="h-4 w-4" />
              {isSavingPassword ? 'Updating...' : 'Update password'}
            </button>
          </form>
        </motion.section>
      </div>
    </CustomerShell>
  );
}

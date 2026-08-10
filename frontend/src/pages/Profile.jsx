import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { BadgeCheck, Camera, Mail, Phone, Save, ShieldCheck, Trash2, UserRound } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import CustomerShell from '../components/dashboard/CustomerShell';
import SkeletonBlock from '../components/SkeletonBlock';
import { AuthContext } from '../context/AuthContext';
import { apiFetch } from '../utils/api';
import { normalizeRole } from '../utils/auth';

export default function Profile() {
  const navigate = useNavigate();
  const { user, displayName, updateUser, logout } = useContext(AuthContext);
  const role = normalizeRole(user?.role || 'customer');
  const [toast, setToast] = useState('');
  const [toastType, setToastType] = useState('success');
  const [profile, setProfile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [form, setForm] = useState({ firstname: '', lastname: '', phone: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const fileInputRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    const loadProfile = async () => {
      try {
        const response = await apiFetch('/users/profile');
        const data = response.data;
        if (!mounted) return;
        setProfile(data);
        setForm({
          firstname: data.fullname?.firstname || '',
          lastname: data.fullname?.lastname || '',
          phone: data.phone || '',
        });
      } catch {
        if (mounted) setToast('Unable to load profile.');
      } finally {
        if (mounted) setIsLoading(false);
      }
    };
    loadProfile();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => () => {
    if (avatarPreview) {
      URL.revokeObjectURL(avatarPreview);
    }
  }, [avatarPreview]);

  const fullName = useMemo(() => {
    const first = form.firstname?.trim();
    const last = form.lastname?.trim();
    return [first, last].filter(Boolean).join(' ') || displayName || profile?.email || user?.email || 'RideFlow user';
  }, [displayName, form.firstname, form.lastname, profile?.email, user?.email]);

  const initials = useMemo(() => fullName.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase(), [fullName]);

  const profileDetails = useMemo(() => [
    { label: 'Full name', value: fullName, icon: UserRound },
    { label: 'Email', value: profile?.email || user?.email || 'Not available', icon: Mail },
    ...(role === 'admin' ? [] : [{ label: 'Phone', value: form.phone || profile?.phone || 'Not provided', icon: Phone }]),
    { label: 'Role', value: role, icon: ShieldCheck },
  ], [form.phone, fullName, profile?.email, profile?.phone, role, user?.email]);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (avatarPreview) {
      URL.revokeObjectURL(avatarPreview);
    }

    setAvatarPreview(URL.createObjectURL(file));
    setToastType('info');
    setToast(`Selected ${file.name} for your profile photo preview.`);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await apiFetch('/users/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          fullname: { firstname: form.firstname, lastname: form.lastname },
          phone: form.phone,
        }),
      });
      const nextProfile = response.data;
      const nextUser = {
        ...user,
        ...nextProfile,
        id: nextProfile.id || nextProfile._id || user?.id,
        _id: nextProfile._id || nextProfile.id || user?._id,
        role: normalizeRole(nextProfile.role || user?.role),
        name: `${form.firstname} ${form.lastname}`.trim() || fullName,
      };
      setProfile(nextProfile);
      updateUser(nextUser);
      setToastType('success');
      setToast('Profile updated successfully.');
    } catch (error) {
      setToastType('error');
      setToast(error?.message || 'Unable to update profile.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    const confirmed = window.confirm('Delete your RideFlow account permanently? This action cannot be undone.');
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      await apiFetch('/users/profile', { method: 'DELETE' });
      await logout();
      navigate('/');
    } catch (error) {
      setToastType('error');
      setToast(error?.message || 'Unable to delete account.');
      setIsDeleting(false);
    }
  };

  const statCards = [
    ['Total rides', String(profile?.stats?.totalRides || 0)],
    ['Completed', String(profile?.stats?.completedRides || 0)],
    ['Cancelled', String(profile?.stats?.cancelledRides || 0)],
    [role === 'driver' ? 'Earnings' : role === 'admin' ? 'Revenue view' : 'Spend', `Rs ${Math.round(profile?.stats?.revenue || 0)}`],
  ];

  return (
    <CustomerShell toast={toast} toastType={toastType} onDismissToast={() => setToast('')}>
      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="theme-panel theme-border rounded-[34px] p-6 shadow-[0_24px_80px_rgba(2,6,23,0.16)]">
          {isLoading ? (
            <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
              <SkeletonBlock className="h-24 w-24 rounded-[28px]" />
              <div className="w-full space-y-3">
                <SkeletonBlock className="h-4 w-24" />
                <SkeletonBlock className="h-10 w-56" />
                <SkeletonBlock className="h-5 w-full max-w-sm" />
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
                <div className="relative">
                  <div className="theme-avatar-ring flex h-24 w-24 items-center justify-center overflow-hidden rounded-[28px] bg-gradient-to-br from-cyan-300/25 to-indigo-400/25 text-2xl font-semibold text-white shadow-[0_20px_55px_rgba(56,189,248,0.18)]">
                    {avatarPreview ? (
                      <img src={avatarPreview} alt="Selected profile avatar preview" className="h-full w-full object-cover" />
                    ) : (
                      initials || 'RF'
                    )}
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
                  <button type="button" onClick={handleAvatarClick} className="theme-subtle theme-border absolute -bottom-2 -right-2 flex h-10 w-10 items-center justify-center rounded-2xl">
                    <Camera className="h-4 w-4" />
                  </button>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="theme-accent text-[11px] font-semibold uppercase tracking-[0.34em]">Profile</p>
                  <h1 className="theme-heading mt-3 break-words text-3xl font-semibold tracking-[-0.05em] sm:text-4xl">{fullName}</h1>
                  <p className="theme-copy mt-2 break-words text-sm leading-6">{profile?.email || user?.email}</p>
                  <div className="mt-4 inline-flex max-w-full items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-500">
                    <BadgeCheck className="h-4 w-4 shrink-0" />
                    <span className="break-words">Role: {role}</span>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {profileDetails.map(({ label, value, icon: Icon }) => (
                  <div key={label} className="theme-soft-card theme-hover-card rounded-[24px] p-4">
                    <div className="flex items-start gap-3">
                      <div className="theme-subtle flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="theme-label text-xs uppercase tracking-[0.24em]">{label}</p>
                        <p className="theme-heading mt-2 break-words text-sm font-semibold capitalize sm:text-base">{value}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {statCards.map(([label, value], index) => (
                  <motion.div
                    key={label}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 + index * 0.05 }}
                    className="theme-soft-card theme-hover-card rounded-[24px] p-4"
                  >
                    <p className="theme-label text-xs uppercase tracking-[0.24em]">{label}</p>
                    <p className="theme-heading mt-3 break-words text-2xl font-bold">{value}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </motion.section>

        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }} className="theme-panel theme-border rounded-[34px] p-6 shadow-[0_24px_80px_rgba(2,6,23,0.16)]">
          <p className="theme-accent text-[11px] font-semibold uppercase tracking-[0.34em]">Editable details</p>
          <h2 className="theme-heading mt-3 text-2xl font-semibold tracking-[-0.04em] sm:text-3xl">Personal information</h2>
          <p className="theme-copy mt-3 max-w-2xl break-words text-sm leading-7">
            Update your account details here. The same responsive layout is used across customer, driver, and admin so long names and emails stay readable on smaller screens.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {isLoading ? (
              <>
                <SkeletonBlock className="h-14" />
                <SkeletonBlock className="h-14" />
                <SkeletonBlock className="h-14 sm:col-span-2" />
                <SkeletonBlock className="h-14 sm:col-span-2" />
              </>
            ) : (
              <>
                <label className="block">
                  <span className="theme-label mb-2 block text-xs uppercase tracking-[0.24em]">First name</span>
                  <input value={form.firstname} onChange={(event) => setForm((current) => ({ ...current, firstname: event.target.value }))} className="theme-input h-14 w-full rounded-2xl px-4 text-sm outline-none" />
                </label>
                <label className="block">
                  <span className="theme-label mb-2 block text-xs uppercase tracking-[0.24em]">Last name</span>
                  <input value={form.lastname} onChange={(event) => setForm((current) => ({ ...current, lastname: event.target.value }))} className="theme-input h-14 w-full rounded-2xl px-4 text-sm outline-none" />
                </label>
                <label className="block sm:col-span-2">
                  <span className="theme-label mb-2 block text-xs uppercase tracking-[0.24em]">Email</span>
                  <div className="theme-soft-card theme-heading flex min-h-[56px] items-center gap-3 rounded-2xl px-4 text-sm break-all">
                    <Mail className="h-4 w-4 shrink-0" />
                    <span className="break-all">{profile?.email || user?.email}</span>
                  </div>
                </label>
                {role !== 'admin' ? (
                  <label className="block sm:col-span-2">
                    <span className="theme-label mb-2 block text-xs uppercase tracking-[0.24em]">Phone</span>
                    <div className="relative">
                      <Phone className="theme-label pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2" />
                      <input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} className="theme-input h-14 w-full rounded-2xl pl-11 pr-4 text-sm outline-none" />
                    </div>
                  </label>
                ) : null}
              </>
            )}
          </div>
          <button type="button" onClick={handleSave} disabled={isSaving || isLoading} className="theme-primary-button mt-6 inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl px-6 text-sm font-semibold shadow-[0_18px_50px_rgba(56,189,248,0.16)] transition hover:-translate-y-0.5 disabled:opacity-60 sm:w-auto">
            <Save className="h-4 w-4" />
            {isSaving ? 'Saving...' : 'Save profile'}
          </button>

          <button
            type="button"
            onClick={handleDeleteAccount}
            disabled={isDeleting || isLoading}
            className="theme-secondary-button mt-4 inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl px-6 text-sm font-semibold text-rose-600 transition hover:-translate-y-0.5 disabled:opacity-60 sm:w-auto"
          >
            <Trash2 className="h-4 w-4" />
            {isDeleting ? 'Deleting...' : 'Delete account'}
          </button>
        </motion.section>
      </div>
    </CustomerShell>
  );
}

import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CarFront,
  CreditCard,
  KeyRound,
  Mail,
  Phone,
  ShieldAlert,
  ShieldCheck,
  UserCog,
  UserRound,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import AnimatedButton from '../components/AnimatedButton';
import AuthCard from '../components/AuthCard';
import FormInput from '../components/FormInput';
import RoleBadge from '../components/RoleBadge';
import { AuthContext } from '../context/AuthContext';

const roleThemes = {
  customer: {
    title: 'Customer Signup',
    heading: 'Create a rider account built for premium mobility.',
    description: 'Save your details, book rides faster, and step straight into a refined customer workspace.',
    glow: 'cyan',
    icon: UserRound,
    badgeClass: 'border-sky-300 bg-sky-100 text-sky-800 shadow-[0_10px_24px_rgba(14,165,233,0.14)]',
    accentTextClass: 'text-sky-700',
    accentLinkClass: 'text-sky-700 hover:text-blue-700',
    orbLeft: 'bg-cyan-300/16',
    orbRight: 'bg-indigo-300/14',
    infoIconClass: 'text-sky-600',
  },
  driver: {
    title: 'Driver Signup',
    heading: 'Join the RideFlow driver network with a polished onboarding flow.',
    description: 'Set up your profile, submit key vehicle details, and get ready for dispatch and earnings.',
    glow: 'emerald',
    icon: CarFront,
    badgeClass: 'border-emerald-300 bg-emerald-100 text-emerald-800 shadow-[0_10px_24px_rgba(16,185,129,0.14)]',
    accentTextClass: 'text-emerald-700',
    accentLinkClass: 'text-emerald-700 hover:text-teal-700',
    orbLeft: 'bg-emerald-300/16',
    orbRight: 'bg-sky-300/14',
    infoIconClass: 'text-emerald-600',
  },
  admin: {
    title: 'Admin Signup',
    heading: 'Provision secure access for platform operators.',
    description: 'Create a protected admin account with elevated controls and marketplace visibility.',
    glow: 'violet',
    icon: UserCog,
    badgeClass: 'border-violet-300 bg-violet-100 text-violet-800 shadow-[0_10px_24px_rgba(139,92,246,0.14)]',
    accentTextClass: 'text-violet-700',
    accentLinkClass: 'text-violet-700 hover:text-indigo-700',
    orbLeft: 'bg-violet-300/16',
    orbRight: 'bg-fuchsia-300/14',
    infoIconClass: 'text-violet-600',
  },
};

const roleOptions = [
  { key: 'customer', title: 'Customer', subtitle: 'Book rides and track every trip.', icon: UserRound },
  { key: 'driver', title: 'Driver', subtitle: 'Manage requests, routes, and earnings.', icon: CarFront },
  { key: 'admin', title: 'Admin', subtitle: 'Operate the platform and approvals layer.', icon: UserCog },
];

const vehicleOptions = [
  { value: 'car', label: 'Car' },
  { value: 'auto', label: 'Auto' },
  { value: 'motorcycle', label: 'Motorcycle' },
  { value: 'van', label: 'Van' },
];

const resolveRole = (rawRole) => (rawRole && roleThemes[rawRole] ? rawRole : 'customer');
const driverSteps = [
  { key: 'identity', title: 'Identity', description: 'Basic account details and contact information.' },
  { key: 'vehicle', title: 'Vehicle', description: 'Vehicle class and licensing information.' },
  { key: 'security', title: 'Security', description: 'Confirm account strength and create the profile.' },
];

const getPasswordStrength = (password) => {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  if (score <= 1) return { label: 'Weak', width: '25%', tone: 'bg-rose-400' };
  if (score === 2) return { label: 'Fair', width: '50%', tone: 'bg-amber-400' };
  if (score === 3) return { label: 'Strong', width: '75%', tone: 'bg-cyan-400' };
  return { label: 'Excellent', width: '100%', tone: 'bg-emerald-400' };
};

export default function Signup() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { signup } = useContext(AuthContext);
  const [role, setRole] = useState(resolveRole(searchParams.get('role')));
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    vehicleType: 'car',
    licenseNumber: '',
    adminCode: '',
  });
  const [errors, setErrors] = useState({});
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('error');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [driverStep, setDriverStep] = useState(0);
  const toastTimeoutRef = useRef(null);

  useEffect(() => {
    const nextRole = resolveRole(searchParams.get('role'));
    setRole((current) => (current === nextRole ? current : nextRole));
  }, [searchParams]);

  useEffect(() => () => window.clearTimeout(toastTimeoutRef.current), []);

  useEffect(() => {
    if (role !== 'driver') {
      setDriverStep(0);
    }
  }, [role]);

  const theme = roleThemes[role];
  const strength = useMemo(() => getPasswordStrength(form.password), [form.password]);

  const showToast = (message, type = 'error') => {
    setToastType(type);
    setToastMessage(message);
    window.clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = window.setTimeout(() => setToastMessage(''), 2600);
  };

  const handleRoleChange = (nextRole) => {
    setRole(nextRole);
    setErrors({});
    setDriverStep(0);
    setSearchParams({ role: nextRole });
  };

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: '' }));
  };

  const validate = () => {
    const nextErrors = {};

    if (!form.name.trim()) nextErrors.name = 'Name is required.';
    if (!form.email.trim()) {
      nextErrors.email = 'Email is required.';
    } else if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) {
      nextErrors.email = 'Enter a valid email address.';
    }
    if (!form.password) {
      nextErrors.password = 'Password is required.';
    } else if (form.password.length < 8) {
      nextErrors.password = 'Use at least 8 characters.';
    }

    if (role !== 'admin') {
      if (!form.phone.trim()) {
        nextErrors.phone = 'Phone number is required.';
      } else if (!/^\+?[\d\s-]{10,15}$/.test(form.phone.trim())) {
        nextErrors.phone = 'Enter a valid phone number.';
      }
    }

    if (role === 'driver') {
      if (!form.vehicleType) nextErrors.vehicleType = 'Vehicle type is required.';
      if (!form.licenseNumber.trim()) nextErrors.licenseNumber = 'License number is required.';
    }

    if (role === 'admin' && !form.adminCode.trim()) {
      nextErrors.adminCode = 'Admin code is required.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const validateDriverStep = (stepIndex) => {
    const nextErrors = {};

    if (stepIndex === 0) {
      if (!form.name.trim()) nextErrors.name = 'Name is required.';
      if (!form.email.trim()) {
        nextErrors.email = 'Email is required.';
      } else if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) {
        nextErrors.email = 'Enter a valid email address.';
      }
      if (!form.phone.trim()) {
        nextErrors.phone = 'Phone number is required.';
      } else if (!/^\+?[\d\s-]{10,15}$/.test(form.phone.trim())) {
        nextErrors.phone = 'Enter a valid phone number.';
      }
    }

    if (stepIndex === 1) {
      if (!form.vehicleType) nextErrors.vehicleType = 'Vehicle type is required.';
      if (!form.licenseNumber.trim()) nextErrors.licenseNumber = 'License number is required.';
    }

    if (stepIndex === 2) {
      if (!form.password) {
        nextErrors.password = 'Password is required.';
      } else if (form.password.length < 8) {
        nextErrors.password = 'Use at least 8 characters.';
      }
    }

    setErrors((current) => ({ ...current, ...nextErrors }));
    return Object.keys(nextErrors).length === 0;
  };

  const handleNextDriverStep = () => {
    if (!validateDriverStep(driverStep)) {
      showToast('Please complete this step before continuing.');
      return;
    }
    setDriverStep((current) => Math.min(current + 1, driverSteps.length - 1));
  };

  const handlePreviousDriverStep = () => {
    setDriverStep((current) => Math.max(current - 1, 0));
  };

  const isFormInvalid = !form.name.trim()
    || !form.email.trim()
    || form.password.length < 8
    || (role !== 'admin' && !form.phone.trim())
    || (role === 'driver' && (!form.vehicleType || !form.licenseNumber.trim()))
    || (role === 'admin' && !form.adminCode.trim());

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (role === 'driver' && driverStep < driverSteps.length - 1) {
      handleNextDriverStep();
      return;
    }

    if (!validate()) {
      showToast('Please fix the highlighted fields.');
      return;
    }

    setIsSubmitting(true);

    try {
      const data = await signup({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role,
        phone: role === 'admin' ? undefined : form.phone.trim(),
        adminCode: role === 'admin' ? form.adminCode.trim() : undefined,
        extraFields: role === 'driver'
          ? {
              vehicleType: form.vehicleType,
              licenseNumber: form.licenseNumber.trim(),
            }
          : {},
        remember: true,
      });

      setShowSuccess(true);
      showToast(`${data.user.role.charAt(0).toUpperCase() + data.user.role.slice(1)} account created successfully.`, 'success');
      window.setTimeout(() => navigate(`/dashboard/${data.user.role}`), 900);
    } catch (error) {
      const message = error?.response?.data?.message || error?.message || 'Unable to create account.';
      showToast(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.main
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.4 }}
      className="theme-auth-shell relative isolate min-h-screen overflow-hidden px-4 py-8 text-slate-900 sm:px-6 lg:px-8"
    >
      <div className="aurora-bg" />
      <div className="auth-mesh" />
      <div className={`dashboard-orb left-[3%] top-[6%] h-64 w-64 ${theme.orbLeft}`} />
      <div className={`dashboard-orb right-[8%] top-[18%] h-72 w-72 ${theme.orbRight}`} />

      <AnimatePresence>
        {toastMessage ? (
          <div className="pointer-events-none fixed inset-x-0 top-6 z-50 flex justify-center px-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className={`toast-premium pointer-events-auto flex items-center gap-3 rounded-2xl px-4 py-3 text-sm backdrop-blur-2xl ${
                toastType === 'success'
                  ? 'min-w-[280px] border border-emerald-600 bg-emerald-600 text-white shadow-[0_20px_60px_rgba(16,185,129,0.24)] dark:border-emerald-300/40 dark:bg-emerald-500/12 dark:text-emerald-100'
                  : 'min-w-[280px] border border-rose-600 bg-rose-600 text-white shadow-[0_20px_60px_rgba(244,63,94,0.22)] dark:border-rose-300/40 dark:bg-rose-500/12 dark:text-rose-100'
              }`}
            >
              <ShieldAlert className={`h-5 w-5 ${toastType === 'success' ? 'text-white dark:text-emerald-300' : 'text-white dark:text-rose-300'}`} />
              <span>{toastMessage}</span>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>

      <section className="relative mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-7xl items-center justify-center">
        <div className="grid w-full gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <AuthCard className="hidden p-8 lg:flex lg:flex-col lg:justify-between" delay={0} accent={theme.glow}>
            <div>
              <Link to={`/login?role=${role}`} className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 transition hover:text-slate-950">
                <ArrowLeft className="h-4 w-4" />
                Back to login
              </Link>
              <div className="mt-10">
                <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.32em] ${theme.badgeClass}`}>
                  {theme.title}
                </span>
                <h1 className="mt-6 max-w-lg text-5xl font-semibold tracking-[-0.06em] text-slate-950">{theme.heading}</h1>
                <p className="mt-5 max-w-xl text-base leading-7 text-slate-700">{theme.description}</p>
              </div>
              <div className="mt-8 grid gap-3 md:grid-cols-3">
                {[
                  ['Guided', 'Role-based fields and flow'],
                  ['Secure', 'Signup with instant JWT session'],
                  ['Smooth', 'Animated transitions and feedback'],
                ].map(([label, text]) => (
                  <div key={label} className="rounded-[22px] border border-slate-200/90 bg-white/80 px-4 py-4 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
                    <p className={`text-[11px] uppercase tracking-[0.24em] ${theme.accentTextClass}`}>{label}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-700">{text}</p>
                  </div>
                ))}
              </div>

              <div className="mt-8 grid gap-3">
                {roleOptions.map((item) => (
                  <RoleBadge
                    key={item.key}
                    active={item.key === role}
                    icon={item.icon}
                    title={item.title}
                    subtitle={item.subtitle}
                    tone="light"
                    onClick={() => handleRoleChange(item.key)}
                  />
                ))}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-[28px] border border-slate-200/90 bg-white/82 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
                <ShieldCheck className={`h-6 w-6 ${theme.infoIconClass}`} />
                <p className="mt-4 text-sm font-semibold text-slate-950">Frictionless access</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">Signup creates the account, authenticates the session, and routes the user into the correct dashboard.</p>
              </div>
              <div className="rounded-[28px] border border-slate-200/90 bg-white/82 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
                <BadgeCheck className={`h-6 w-6 ${theme.infoIconClass}`} />
                <p className="mt-4 text-sm font-semibold text-slate-950">Production-ready validation</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">Role-aware fields, stronger password cues, and protected admin onboarding through a secure code.</p>
              </div>
            </div>
          </AuthCard>

          <AuthCard className="p-6 sm:p-8" delay={0.06} accent={theme.glow}>
            <div className="lg:hidden">
              <Link to={`/login?role=${role}`} className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 transition hover:text-slate-950">
                <ArrowLeft className="h-4 w-4" />
                Back to login
              </Link>
            </div>

            <div className="mt-3 lg:mt-0">
              <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] ${theme.badgeClass}`}>
                Create account
              </span>
              <h2 className="mt-6 text-3xl font-semibold tracking-[-0.05em] text-slate-950">Join RideFlow</h2>
              <p className="mt-3 text-sm leading-6 text-slate-700">Choose a role and complete the fields for a polished, role-aware signup experience.</p>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3 lg:hidden">
              {roleOptions.map((item) => (
                <RoleBadge
                  key={item.key}
                  active={item.key === role}
                  icon={item.icon}
                  title={item.title}
                  subtitle={item.subtitle}
                  tone="light"
                  onClick={() => handleRoleChange(item.key)}
                />
              ))}
            </div>

            <motion.form onSubmit={handleSubmit} className="mt-8 space-y-4">
              {role === 'driver' ? (
                <>
                  <div className="rounded-[24px] border border-slate-200/90 bg-white/82 p-4 shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className={`text-xs uppercase tracking-[0.24em] ${theme.accentTextClass}`}>Driver onboarding</p>
                        <h3 className="mt-2 text-lg font-semibold text-slate-950">{driverSteps[driverStep].title}</h3>
                        <p className="mt-1 text-sm text-slate-700">{driverSteps[driverStep].description}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
                        Step {driverStep + 1}/{driverSteps.length}
                      </div>
                    </div>
                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-500"
                        initial={false}
                        animate={{ width: `${((driverStep + 1) / driverSteps.length) * 100}%` }}
                        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                      />
                    </div>
                    <div className="mt-4 grid gap-2 sm:grid-cols-3">
                      {driverSteps.map((step, index) => (
                        <div
                          key={step.key}
                          className={`rounded-2xl border px-3 py-3 text-xs transition ${
                            index === driverStep
                              ? 'border-emerald-300/40 bg-emerald-50 text-emerald-700'
                              : index < driverStep
                                ? 'border-sky-300/35 bg-sky-50 text-sky-700'
                                : 'border-slate-200 bg-slate-50 text-slate-500'
                          }`}
                        >
                          <p className="font-semibold uppercase tracking-[0.18em]">{step.title}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <AnimatePresence mode="wait">
                    <motion.div
                      key={driverStep}
                      initial={{ opacity: 0, x: 18 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -18 }}
                      transition={{ duration: 0.28 }}
                      className="space-y-4"
                    >
                      {driverStep === 0 ? (
                        <>
                          <FormInput
                            label="Full name"
                            name="name"
                            value={form.name}
                            onChange={(event) => updateField('name', event.target.value)}
                            icon={UserRound}
                            error={errors.name}
                          />
                          <FormInput
                            label="Email"
                            name="email"
                            type="email"
                            value={form.email}
                            onChange={(event) => updateField('email', event.target.value)}
                            icon={Mail}
                            error={errors.email}
                            autoComplete="email"
                          />
                          <FormInput
                            label="Phone"
                            name="phone"
                            value={form.phone}
                            onChange={(event) => updateField('phone', event.target.value)}
                            icon={Phone}
                            error={errors.phone}
                            inputMode="tel"
                          />
                        </>
                      ) : null}

                      {driverStep === 1 ? (
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div>
                            <label className="mb-2 block text-xs uppercase tracking-[0.24em] text-slate-500">Vehicle type</label>
                            <div className={`relative rounded-[22px] border bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.96))] ${errors.vehicleType ? 'border-rose-400/40 shadow-[0_0_0_4px_rgba(244,63,94,0.08)]' : 'border-slate-200/85 shadow-[0_12px_32px_rgba(15,23,42,0.08)]'}`}>
                              <CreditCard className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
                              <select
                                value={form.vehicleType}
                                onChange={(event) => updateField('vehicleType', event.target.value)}
                                className="h-16 w-full appearance-none rounded-[22px] bg-transparent pl-12 pr-4 text-sm text-slate-900 outline-none"
                              >
                                {vehicleOptions.map((option) => (
                                  <option key={option.value} value={option.value} className="bg-white text-slate-900">
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            {errors.vehicleType ? <p className="mt-2 text-xs text-rose-500">{errors.vehicleType}</p> : null}
                          </div>

                          <FormInput
                            label="License number"
                            name="licenseNumber"
                            value={form.licenseNumber}
                            onChange={(event) => updateField('licenseNumber', event.target.value)}
                            icon={BadgeCheck}
                            error={errors.licenseNumber}
                          />
                        </div>
                      ) : null}

                      {driverStep === 2 ? (
                        <>
                          <FormInput
                            label="Password"
                            name="password"
                            type="password"
                            value={form.password}
                            onChange={(event) => updateField('password', event.target.value)}
                            icon={KeyRound}
                            error={errors.password}
                            autoComplete="new-password"
                          />
                          <div>
                            <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                              <div className={`h-full rounded-full transition-all duration-300 ${strength.tone}`} style={{ width: strength.width }} />
                            </div>
                            <p className="mt-2 text-xs text-slate-500">Password strength: <span className="font-semibold text-slate-900">{strength.label}</span></p>
                          </div>
                          <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                            Your driver account will be created in a pending review state until operations approval is completed.
                          </div>
                        </>
                      ) : null}
                    </motion.div>
                  </AnimatePresence>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={handlePreviousDriverStep}
                      disabled={driverStep === 0 || isSubmitting}
                      className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Previous
                    </button>
                    <AnimatedButton type="submit" loading={isSubmitting || showSuccess} glow={theme.glow}>
                      {driverStep < driverSteps.length - 1
                        ? <>Continue <ArrowRight className="h-4 w-4" /></>
                        : showSuccess
                          ? 'Redirecting...'
                          : isSubmitting
                            ? 'Creating account...'
                            : 'Create Driver Account'}
                    </AnimatedButton>
                  </div>
                </>
              ) : (
                <>
                  <FormInput
                    label="Full name"
                    name="name"
                    value={form.name}
                    onChange={(event) => updateField('name', event.target.value)}
                    icon={UserRound}
                    error={errors.name}
                  />

                  <FormInput
                    label="Email"
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={(event) => updateField('email', event.target.value)}
                    icon={Mail}
                    error={errors.email}
                    autoComplete="email"
                  />

                  <FormInput
                    label="Password"
                    name="password"
                    type="password"
                    value={form.password}
                    onChange={(event) => updateField('password', event.target.value)}
                    icon={KeyRound}
                    error={errors.password}
                    autoComplete="new-password"
                  />

                  <div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                      <div className={`h-full rounded-full transition-all duration-300 ${strength.tone}`} style={{ width: strength.width }} />
                    </div>
                    <p className="mt-2 text-xs text-slate-500">Password strength: <span className="font-semibold text-slate-900">{strength.label}</span></p>
                  </div>

                  {role !== 'admin' ? (
                    <FormInput
                      label="Phone"
                      name="phone"
                      value={form.phone}
                      onChange={(event) => updateField('phone', event.target.value)}
                      icon={Phone}
                      error={errors.phone}
                      inputMode="tel"
                    />
                  ) : null}

                  {role === 'admin' ? (
                <FormInput
                  label="Admin code"
                  name="adminCode"
                  value={form.adminCode}
                  onChange={(event) => updateField('adminCode', event.target.value)}
                  icon={ShieldCheck}
                  error={errors.adminCode}
                />
                  ) : null}

                  <AnimatedButton type="submit" loading={isSubmitting || showSuccess} disabled={isFormInvalid} glow={theme.glow}>
                    {showSuccess ? 'Redirecting...' : isSubmitting ? 'Creating account...' : `Create ${role.charAt(0).toUpperCase() + role.slice(1)} Account`}
                  </AnimatedButton>
                </>
              )}
            </motion.form>

            <AnimatePresence>
              {showSuccess ? (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 12 }}
                  className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
                >
                  Account created and session secured. Taking you to your dashboard now.
                </motion.div>
              ) : null}
            </AnimatePresence>

                  <div className="mt-6 border-t border-slate-200 pt-6 text-sm text-slate-700">
              Already have an account?{' '}
              <Link to={`/login?role=${role}`} className={`font-semibold transition ${theme.accentLinkClass}`}>
                Sign in
              </Link>
            </div>
          </AuthCard>
        </div>
      </section>
    </motion.main>
  );
}

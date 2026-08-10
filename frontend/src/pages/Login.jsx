import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, KeyRound, Mail, ShieldAlert } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import AnimatedButton from '../components/AnimatedButton';
import AuthCard from '../components/AuthCard';
import FormInput from '../components/FormInput';
import { AuthContext } from '../context/AuthContext';

const roleCopy = {
  customer: {
    title: 'Customer Login',
    description: 'Sign in to book and manage rides.',
    badgeClass: 'border-sky-300 bg-sky-100 text-sky-800 shadow-[0_10px_24px_rgba(14,165,233,0.14)]',
    logoClass: 'border-sky-200 from-sky-500 via-blue-600 to-indigo-600 shadow-[0_18px_44px_rgba(37,99,235,0.28)]',
    brandClass: 'text-sky-700',
    linkClass: 'text-sky-700 hover:text-blue-700',
    backClass: 'text-slate-700 hover:text-slate-950',
    accent: 'cyan',
    orbLeft: 'bg-cyan-300/16',
    orbRight: 'bg-indigo-300/14',
  },
  driver: {
    title: 'Driver Login',
    description: 'Sign in to manage requests and trips.',
    badgeClass: 'border-emerald-300 bg-emerald-100 text-emerald-800 shadow-[0_10px_24px_rgba(16,185,129,0.14)]',
    logoClass: 'border-emerald-200 from-emerald-500 via-teal-500 to-sky-500 shadow-[0_18px_44px_rgba(16,185,129,0.24)]',
    brandClass: 'text-emerald-700',
    linkClass: 'text-emerald-700 hover:text-teal-700',
    backClass: 'text-slate-700 hover:text-slate-950',
    accent: 'emerald',
    orbLeft: 'bg-emerald-300/16',
    orbRight: 'bg-sky-300/14',
  },
  admin: {
    title: 'Admin Login',
    description: 'Sign in to access platform operations.',
    badgeClass: 'border-violet-300 bg-violet-100 text-violet-800 shadow-[0_10px_24px_rgba(139,92,246,0.14)]',
    logoClass: 'border-violet-200 from-indigo-500 via-violet-600 to-fuchsia-500 shadow-[0_18px_44px_rgba(99,102,241,0.26)]',
    brandClass: 'text-violet-700',
    linkClass: 'text-violet-700 hover:text-indigo-700',
    backClass: 'text-slate-700 hover:text-slate-950',
    accent: 'violet',
    orbLeft: 'bg-violet-300/16',
    orbRight: 'bg-fuchsia-300/14',
  },
};

const resolveRole = (rawRole) => (rawRole && roleCopy[rawRole] ? rawRole : 'customer');

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useContext(AuthContext);
  const role = resolveRole(searchParams.get('role'));
  const copy = roleCopy[role];
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('error');
  const toastTimeoutRef = useRef(null);

  const buttonGlow = useMemo(() => copy.accent, [copy.accent]);

  const showToast = (message, type = 'error') => {
    setToastType(type);
    setToastMessage(message);
    window.clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = window.setTimeout(() => setToastMessage(''), 2400);
  };

  useEffect(() => () => window.clearTimeout(toastTimeoutRef.current), []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!email.trim() || !password.trim()) {
      showToast('Enter your email and password.');
      return;
    }

    setIsLoading(true);
    try {
      const data = await login({ email: email.trim(), password, role, remember: true });
      navigate(`/dashboard/${data.user.role}`);
    } catch (error) {
      showToast(error?.response?.data?.message || error?.message || 'Unable to sign in.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.main initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="theme-auth-shell relative isolate flex min-h-screen items-center justify-center overflow-hidden px-4 py-8 text-slate-900 dark:text-white sm:px-6">
      <div className="aurora-bg" />
      <div className="auth-mesh" />
      <div className={`dashboard-orb left-[8%] top-[12%] h-56 w-56 ${copy.orbLeft}`} />
      <div className={`dashboard-orb right-[8%] top-[22%] h-64 w-64 ${copy.orbRight}`} />

      <AnimatePresence>
        {toastMessage ? (
          <div className="pointer-events-none fixed inset-x-0 top-6 z-50 flex justify-center px-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className={`toast-premium pointer-events-auto flex min-w-[280px] items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold shadow-[0_16px_45px_rgba(15,23,42,0.12)] backdrop-blur-2xl ${toastType === 'success' ? 'border border-emerald-600 bg-emerald-600 text-white shadow-[0_18px_40px_rgba(16,185,129,0.28)] dark:border-emerald-300/40 dark:bg-emerald-500/12 dark:text-emerald-100' : 'border border-rose-600 bg-rose-600 text-white shadow-[0_18px_40px_rgba(244,63,94,0.28)] dark:border-rose-300/40 dark:bg-rose-500/12 dark:text-rose-100'}`}
            >
              <ShieldAlert className={`h-5 w-5 ${toastType === 'success' ? 'text-white dark:text-emerald-300' : 'text-white dark:text-rose-300'}`} />
              <span>{toastMessage}</span>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>

      <AuthCard className="w-full max-w-md p-7 sm:p-8" delay={0.04} accent={copy.accent}>
        <Link to="/" className={`inline-flex items-center gap-2 text-sm font-medium transition ${copy.backClass} dark:text-slate-300 dark:hover:text-white`}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>

        <div className="mt-8 text-center">
          <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] ${copy.badgeClass}`}>
            {role}
          </span>
          <div className={`mx-auto mt-5 flex h-14 w-14 items-center justify-center rounded-[20px] border bg-gradient-to-br text-lg font-semibold text-white ${copy.logoClass}`}>
            RF
          </div>
          <p className={`mt-5 text-[11px] font-bold uppercase tracking-[0.34em] ${copy.brandClass} dark:text-cyan-200/75`}>RideFlow</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-slate-900 dark:text-white">{copy.title}</h1>
          <p className="mt-3 text-sm leading-6 text-slate-700 dark:text-slate-400">{copy.description}</p>
        </div>

        <motion.form initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} onSubmit={handleSubmit} className="mt-8 space-y-5">
          <FormInput label="Email" name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} icon={Mail} autoComplete="username" />
          <FormInput label="Password" name="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} icon={KeyRound} autoComplete="current-password" />
          <AnimatedButton type="submit" loading={isLoading} glow={buttonGlow}>
            {isLoading ? 'Signing in...' : 'Login'}
          </AnimatedButton>
        </motion.form>

        <div className="mt-6 text-center text-sm text-slate-700 dark:text-slate-400">
          Don&apos;t have an account? <Link to={`/signup?role=${role}`} className={`font-semibold transition ${copy.linkClass} dark:text-cyan-300 dark:hover:text-cyan-200`}>Sign up</Link>
        </div>
      </AuthCard>
    </motion.main>
  );
}

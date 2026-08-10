import { LoaderCircle } from 'lucide-react';
import { motion } from 'framer-motion';

export default function AnimatedButton({ children, loading = false, className = '', glow = 'cyan', ...props }) {
  const glowClass = glow === 'emerald'
    ? 'from-emerald-500 via-teal-500 to-sky-500 shadow-[0_20px_60px_rgba(16,185,129,0.32)] hover:shadow-[0_26px_75px_rgba(16,185,129,0.4)]'
    : glow === 'violet'
      ? 'from-indigo-500 via-violet-600 to-fuchsia-500 shadow-[0_20px_60px_rgba(139,92,246,0.32)] hover:shadow-[0_26px_75px_rgba(129,140,248,0.4)]'
      : 'from-sky-500 via-blue-600 to-indigo-600 shadow-[0_20px_60px_rgba(56,189,248,0.32)] hover:shadow-[0_26px_75px_rgba(59,130,246,0.4)]';

  return (
    <motion.button
      whileHover={{ scale: loading ? 1 : 1.015, y: loading ? 0 : -2 }}
      whileTap={{ scale: loading ? 1 : 0.985 }}
      disabled={loading || props.disabled}
      className={`auth-button-glow relative inline-flex h-14 w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r px-5 text-sm font-semibold text-white transition duration-300 disabled:cursor-not-allowed disabled:opacity-60 ${glowClass} ${className}`}
      {...props}
    >
      <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.36),transparent)] opacity-0 transition duration-500 group-hover:opacity-100" />
      {loading ? <LoaderCircle className="h-5 w-5 animate-spin" /> : null}
      <span className="relative">{children}</span>
    </motion.button>
  );
}

import { LoaderCircle } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Button({ children, loading = false, className = '', ...props }) {
  return (
    <motion.button
      whileHover={{ scale: loading ? 1 : 1.01, y: loading ? 0 : -1 }}
      whileTap={{ scale: loading ? 1 : 0.99 }}
      className={`inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 via-sky-500 to-indigo-500 px-5 text-sm font-semibold text-slate-950 shadow-[0_18px_45px_rgba(56,189,248,0.35)] transition duration-300 hover:shadow-[0_24px_65px_rgba(59,130,246,0.4)] disabled:cursor-not-allowed disabled:opacity-70 ${className}`}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? <LoaderCircle className="h-5 w-5 animate-spin" /> : null}
      <span>{children}</span>
    </motion.button>
  );
}

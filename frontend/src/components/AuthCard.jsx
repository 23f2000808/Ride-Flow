import { motion } from 'framer-motion';

const accentStyles = {
  cyan: {
    line: 'via-sky-200/85 dark:via-cyan-200/60',
    leftGlow: 'bg-cyan-300/18 dark:bg-cyan-300/12',
    rightGlow: 'bg-indigo-300/18 dark:bg-indigo-300/12',
    overlay: 'bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.1),transparent_36%),radial-gradient(circle_at_bottom_left,rgba(79,70,229,0.08),transparent_38%)]',
  },
  emerald: {
    line: 'via-emerald-200/85 dark:via-emerald-200/60',
    leftGlow: 'bg-emerald-300/18 dark:bg-emerald-300/12',
    rightGlow: 'bg-sky-300/18 dark:bg-sky-300/12',
    overlay: 'bg-[radial-gradient(circle_at_top_right,rgba(52,211,153,0.1),transparent_36%),radial-gradient(circle_at_bottom_left,rgba(14,165,233,0.08),transparent_38%)]',
  },
  violet: {
    line: 'via-violet-200/85 dark:via-violet-200/60',
    leftGlow: 'bg-violet-300/18 dark:bg-violet-300/12',
    rightGlow: 'bg-fuchsia-300/18 dark:bg-fuchsia-300/12',
    overlay: 'bg-[radial-gradient(circle_at_top_right,rgba(167,139,250,0.1),transparent_36%),radial-gradient(circle_at_bottom_left,rgba(236,72,153,0.08),transparent_38%)]',
  },
};

export default function AuthCard({ children, className = '', delay = 0, accent = 'cyan', ...props }) {
  const palette = accentStyles[accent] || accentStyles.cyan;

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: [0.16, 1, 0.3, 1] }}
      className={`auth-card-glow theme-panel-premium theme-border relative overflow-hidden rounded-[34px] shadow-[0_24px_70px_var(--rf-shadow-strong)] backdrop-blur-xl ${className}`}
      {...props}
    >
      <div className={`pointer-events-none absolute inset-0 opacity-90 ${palette.overlay}`} />
      <div className={`pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent ${palette.line} to-transparent opacity-90`} />
      <div className={`pointer-events-none absolute -left-12 top-10 h-28 w-28 rounded-full blur-3xl ${palette.leftGlow}`} />
      <div className={`pointer-events-none absolute -right-10 bottom-6 h-32 w-32 rounded-full blur-3xl ${palette.rightGlow}`} />
      <div className="relative">{children}</div>
    </motion.section>
  );
}

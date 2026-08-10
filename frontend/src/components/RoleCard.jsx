import { ArrowUpRight } from 'lucide-react';
import { motion } from 'framer-motion';

export default function RoleCard({ icon: Icon, title, description, accent, onSelect, delay = 0 }) {
  return (
    <motion.button
      type="button"
      onClick={onSelect}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ scale: 1.02, y: -8 }}
      whileTap={{ scale: 0.98 }}
      className="group role-card-premium theme-panel theme-border theme-hover-card relative overflow-hidden rounded-[32px] p-7 text-left transition duration-300 hover:border-slate-300 dark:backdrop-blur-2xl"
    >
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/55 to-transparent opacity-80" />
      <div
        className="pointer-events-none absolute inset-0 opacity-0 blur-3xl transition duration-500 group-hover:opacity-100"
        style={{ background: accent }}
      />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(145deg,rgba(255,255,255,0.14),transparent_35%,transparent_65%,rgba(129,140,248,0.08))]" />
      <div className="relative flex h-full flex-col">
        <div className="mb-6 flex items-center justify-between">
          <div
            className="theme-subtle flex h-14 w-14 items-center justify-center rounded-2xl text-slate-900 transition duration-300 group-hover:scale-105 dark:text-white"
            style={{ boxShadow: `0 10px 24px ${accent.replace('0.35', '0.1')}` }}
          >
            <Icon className="h-7 w-7" />
          </div>
          <ArrowUpRight className="theme-copy h-5 w-5 transition duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-cyan-400" />
        </div>
        <h3 className="theme-heading text-[1.7rem] font-semibold tracking-[-0.04em]">{title}</h3>
        <p className="theme-copy mt-3 max-w-xs text-sm leading-7">{description}</p>

        <div className="theme-heading mt-8 inline-flex items-center gap-2 text-sm font-medium">
          Continue as {title}
          <span className="h-px w-10 bg-current/25 transition duration-300 group-hover:w-16" />
        </div>
      </div>
    </motion.button>
  );
}

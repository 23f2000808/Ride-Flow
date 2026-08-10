import { motion } from 'framer-motion';

export default function StatCard({ icon: Icon, label, value, trend, accent = 'cyan' }) {
  const accentClasses = {
    cyan: 'from-cyan-300/25 to-sky-500/10 text-cyan-200',
    emerald: 'from-emerald-300/25 to-green-500/10 text-emerald-200',
    amber: 'from-amber-300/25 to-orange-500/10 text-amber-200',
    violet: 'from-violet-300/25 to-indigo-500/10 text-violet-200',
    rose: 'from-rose-300/25 to-pink-500/10 text-rose-200',
  };

  return (
    <motion.div
      whileHover={{ y: -7, scale: 1.015 }}
      transition={{ type: 'spring', stiffness: 250, damping: 18 }}
      className="glass-shimmer group relative overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.13),rgba(255,255,255,0.05))] p-5 shadow-[0_24px_75px_rgba(2,6,23,0.34)] backdrop-blur-3xl"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.12),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.08),transparent_34%)] opacity-70" />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-400">{label}</p>
          <p className="mt-3 text-4xl font-semibold tracking-[-0.07em] text-white">{value}</p>
          {trend ? <p className="mt-4 text-sm leading-6 text-slate-400">{trend}</p> : null}
        </div>
        <div className={`relative flex h-14 w-14 items-center justify-center rounded-[20px] border border-white/10 bg-gradient-to-br ${accentClasses[accent] || accentClasses.cyan} shadow-[0_16px_34px_rgba(15,23,42,0.18)]`}>
          <div className="absolute inset-0 rounded-[20px] bg-white/5 opacity-0 transition duration-300 group-hover:opacity-100" />
          {Icon ? <Icon className="relative h-5 w-5" /> : null}
        </div>
      </div>
    </motion.div>
  );
}

import { motion } from 'framer-motion';

export default function RoleBadge({ active = false, icon: Icon, title, subtitle, onClick, tone = 'dark' }) {
  const isLight = tone === 'light';

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -4, scale: 1.012 }}
      whileTap={{ scale: 0.99 }}
      className={`group relative overflow-hidden rounded-[26px] border px-4 py-4 text-left transition duration-300 ${
        isLight
          ? active
            ? 'border-sky-300/70 bg-[linear-gradient(135deg,rgba(224,242,254,0.98),rgba(232,240,255,0.94))] shadow-[0_20px_48px_rgba(37,99,235,0.16)]'
            : 'border-slate-200/90 bg-white/92 shadow-[0_14px_34px_rgba(37,99,235,0.08)] hover:border-sky-200 hover:bg-white hover:shadow-[0_22px_48px_rgba(37,99,235,0.12)]'
          : active
            ? 'border-cyan-300/40 bg-cyan-300/12 shadow-[0_18px_45px_rgba(56,189,248,0.18)]'
            : 'border-white/10 bg-white/6 shadow-[0_12px_30px_rgba(2,6,23,0.16)] hover:border-white/18 hover:bg-white/10 hover:shadow-[0_20px_44px_rgba(2,6,23,0.2)]'
      }`}
    >
      <div className={`absolute inset-0 opacity-0 transition duration-300 ${
        isLight
          ? active
            ? 'opacity-100 bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.14),transparent_42%)]'
            : 'group-hover:opacity-100 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.08),transparent_42%)]'
          : active
            ? 'opacity-100 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.14),transparent_42%)]'
            : 'group-hover:opacity-100 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.08),transparent_42%)]'
      }`} />
      <div className={`pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent ${isLight ? 'via-slate-200' : 'via-white/45'} to-transparent opacity-70`} />
      <div className="relative flex items-start gap-3">
        <div className={`flex h-11 w-11 items-center justify-center rounded-2xl border shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] ${
          isLight
            ? active
              ? 'border-sky-300/50 bg-sky-100 text-sky-800'
              : 'border-sky-100 bg-[linear-gradient(180deg,rgba(248,251,255,0.98),rgba(238,246,255,0.95))] text-slate-700'
            : active
              ? 'border-cyan-300/30 bg-cyan-300/14 text-cyan-100'
              : 'border-white/10 bg-slate-950/45 text-slate-200'
        }`}>
          {Icon ? <Icon className="h-5 w-5" /> : null}
        </div>
        <div>
          <p className={`text-sm font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>{title}</p>
          <p className={`mt-1 text-xs leading-5 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>{subtitle}</p>
        </div>
      </div>
    </motion.button>
  );
}

import { motion } from 'framer-motion';
import { BarChart3, CarFront, LayoutDashboard, Settings, UserRound, WalletCards } from 'lucide-react';

const iconMap = {
  Dashboard: LayoutDashboard,
  Rides: CarFront,
  Analytics: BarChart3,
  Profile: UserRound,
  Settings: Settings,
};

export default function Sidebar({ roleLabel, items, activeItem, onSelect }) {
  return (
    <aside className="glass-shimmer relative flex w-full max-w-xs flex-col overflow-hidden rounded-[34px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.14),rgba(255,255,255,0.05))] p-6 shadow-[0_28px_90px_rgba(2,6,23,0.52)] backdrop-blur-3xl lg:min-h-[calc(100vh-4rem)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.2),transparent_70%)]" />
      <div className="relative border-b border-white/10 pb-6">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-[20px] bg-gradient-to-br from-cyan-300/30 via-sky-300/10 to-indigo-400/25 text-cyan-100 shadow-[0_16px_45px_rgba(56,189,248,0.26)] ring-1 ring-white/10">
          <WalletCards className="h-6 w-6" />
        </div>
        <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.4em] text-cyan-200/80">RideFlow</p>
        <h2 className="mt-3 text-[30px] font-semibold tracking-[-0.06em] text-white">{roleLabel} Console</h2>
        <p className="mt-3 text-sm leading-7 text-slate-400">
          Command center for operations, trips, and profile controls.
        </p>
      </div>

      <nav className="relative mt-7 space-y-2.5">
        {items.map((item, index) => {
          const Icon = iconMap[item.label] || LayoutDashboard;
          const active = activeItem === item.id;

          return (
            <motion.button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.28, delay: index * 0.04 }}
              whileHover={{ x: 4 }}
              className={`group relative flex w-full items-center gap-3 overflow-hidden rounded-[22px] px-4 py-3.5 text-left text-sm font-medium transition duration-300 ${
                active
                  ? 'bg-[linear-gradient(135deg,rgba(255,255,255,0.18),rgba(255,255,255,0.08))] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_22px_40px_rgba(15,23,42,0.34)]'
                  : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              {active ? (
                <span className="absolute inset-y-2 left-2 w-1 rounded-full bg-gradient-to-b from-cyan-200 to-sky-400 shadow-[0_0_18px_rgba(125,211,252,0.95)]" />
              ) : null}
              <span className={`flex h-11 w-11 items-center justify-center rounded-2xl border transition ${active ? 'border-cyan-300/35 bg-cyan-300/12 text-cyan-100 shadow-[0_0_24px_rgba(103,232,249,0.14)]' : 'border-white/10 bg-white/5 text-slate-400 group-hover:border-cyan-300/20 group-hover:bg-cyan-300/6 group-hover:text-cyan-200'}`}>
                <Icon className="h-4.5 w-4.5" />
              </span>
              <span className="flex-1 text-[15px]">{item.label}</span>
              {active ? <span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_16px_rgba(103,232,249,0.9)]" /> : null}
            </motion.button>
          );
        })}
      </nav>

      <div className="relative mt-auto rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.72),rgba(2,6,23,0.9))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
        <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/35 to-transparent" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-slate-500">Status</p>
        <p className="mt-3 text-sm font-semibold text-white">All systems responsive</p>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Premium dashboard shell with role-aware modules and responsive navigation.
        </p>
      </div>
    </aside>
  );
}

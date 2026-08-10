import { Clock3, MapPin, Wallet } from 'lucide-react';
import { motion } from 'framer-motion';

export default function RideCard({
  ride,
  actions,
  statusTone = 'cyan',
  compact = false,
}) {
  const toneClasses = {
    cyan: 'border-cyan-300/20 bg-cyan-300/10 text-cyan-200',
    emerald: 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200',
    amber: 'border-amber-300/20 bg-amber-300/10 text-amber-200',
    rose: 'border-rose-300/20 bg-rose-300/10 text-rose-200',
  };

  return (
    <motion.div
      whileHover={{ y: -5, scale: 1.01 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      className="glass-shimmer group relative overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.13),rgba(255,255,255,0.05))] p-5 shadow-[0_24px_75px_rgba(2,6,23,0.3)] backdrop-blur-3xl"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.12),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(99,102,241,0.1),transparent_28%)] opacity-80" />
      <div className={`relative flex ${compact ? 'flex-col gap-4' : 'flex-col gap-5 xl:flex-row xl:items-start xl:justify-between'}`}>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <span className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.26em] ${toneClasses[statusTone] || toneClasses.cyan}`}>
              {ride.status}
            </span>
            {ride.live ? (
              <span className="inline-flex items-center gap-2 text-xs font-medium text-emerald-300">
                <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.9)]" />
                Live update
              </span>
            ) : null}
          </div>

          <div className="mt-5 space-y-4">
            <div className="flex items-start gap-3">
              <span className="mt-1 flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-slate-950/45 text-cyan-200 shadow-[0_10px_24px_rgba(15,23,42,0.18)]">
                <MapPin className="h-4 w-4" />
              </span>
              <div>
                <p className="text-[11px] uppercase tracking-[0.26em] text-slate-500">Pickup</p>
                <p className="mt-1.5 text-sm font-medium leading-6 text-white">{ride.pickup}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="mt-1 flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-slate-950/45 text-indigo-200 shadow-[0_10px_24px_rgba(15,23,42,0.18)]">
                <MapPin className="h-4 w-4" />
              </span>
              <div>
                <p className="text-[11px] uppercase tracking-[0.26em] text-slate-500">Drop-off</p>
                <p className="mt-1.5 text-sm font-medium leading-6 text-white">{ride.dropoff}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 xl:min-w-[220px]">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-slate-500">
                <Wallet className="h-3.5 w-3.5" />
                Fare
              </div>
              <p className="mt-2.5 text-xl font-semibold tracking-[-0.04em] text-white">{ride.fare}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-slate-500">
                <Clock3 className="h-3.5 w-3.5" />
                Time
              </div>
              <p className="mt-2.5 text-xl font-semibold tracking-[-0.04em] text-white">{ride.time}</p>
            </div>
          </div>

          {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
        </div>
      </div>
    </motion.div>
  );
}

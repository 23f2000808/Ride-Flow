import { motion } from 'framer-motion';

export default function FormInput({
  label,
  type = 'text',
  value,
  onChange,
  icon: Icon,
  error,
  hint,
  autoComplete,
  name,
  inputMode,
  maxLength,
}) {
  const hasValue = Boolean(value);

  return (
    <motion.label layout className="block">
      <div className={`group auth-input-shell relative overflow-hidden rounded-[22px] border bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(237,246,255,0.96))] dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(30,41,59,0.92))] transition duration-300 ${
        error
          ? 'border-rose-400/40 shadow-[0_0_0_4px_rgba(244,63,94,0.08)]'
          : 'border-sky-200/90 shadow-[0_16px_36px_rgba(37,99,235,0.08)] focus-within:border-sky-500/60 focus-within:shadow-[0_0_0_4px_rgba(14,165,233,0.12),0_20px_44px_rgba(37,99,235,0.12)] dark:border-white/10 dark:shadow-[0_12px_32px_rgba(2,6,23,0.22)] dark:focus-within:border-cyan-300/55 dark:focus-within:shadow-[0_0_0_4px_rgba(34,211,238,0.1),0_18px_46px_rgba(34,211,238,0.1)]'
      }`}>
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(145deg,rgba(14,165,233,0.08),transparent_38%,transparent_70%,rgba(99,102,241,0.08))] dark:bg-[linear-gradient(145deg,rgba(34,211,238,0.08),transparent_38%,transparent_70%,rgba(99,102,241,0.12))]" />
        <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-sky-200 to-transparent opacity-90 dark:via-white/45" />
        {Icon ? (
          <Icon className={`pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 transition duration-300 ${
            hasValue ? 'text-slate-700 dark:text-cyan-100' : 'text-slate-600 group-focus-within:text-sky-700 dark:text-slate-300 dark:group-focus-within:text-cyan-200'
          }`} />
        ) : null}
        <input
          type={type}
          name={name}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          inputMode={inputMode}
          maxLength={maxLength}
          placeholder=" "
          className={`peer h-16 w-full bg-transparent px-4 pb-3 pt-7 text-sm font-semibold text-slate-950 caret-slate-950 outline-none placeholder-transparent dark:text-slate-50 dark:caret-slate-50 ${Icon ? 'pl-12' : 'pl-4'}`}
        />
        <span
          className={`pointer-events-none absolute transition-all duration-200 ${
            Icon ? 'left-12' : 'left-4'
          } ${
            hasValue
              ? 'top-3 text-xs font-semibold uppercase tracking-[0.24em] text-slate-700 dark:text-cyan-100'
              : 'top-1/2 -translate-y-1/2 text-sm font-medium text-slate-700 peer-focus:top-3 peer-focus:translate-y-0 peer-focus:text-xs peer-focus:font-semibold peer-focus:uppercase peer-focus:tracking-[0.24em] peer-focus:text-slate-700 dark:text-slate-200 dark:peer-focus:text-cyan-100'
          }`}
        >
          {label}
        </span>
      </div>
      {error ? <p className="mt-2 text-xs text-rose-600 dark:text-rose-300">{error}</p> : hint ? <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">{hint}</p> : null}
    </motion.label>
  );
}

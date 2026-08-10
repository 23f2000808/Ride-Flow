export default function InputField({
  label,
  type = 'text',
  name,
  placeholder,
  value,
  onChange,
  icon: Icon,
  autoComplete,
}) {
  return (
    <label className="block">
      <span className="mb-3 block text-sm font-medium text-slate-200">{label}</span>
      <div className="group relative">
        {Icon ? (
          <Icon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 transition duration-300 group-focus-within:text-cyan-300" />
        ) : null}
        <input
          type={type}
          name={name}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          className="h-14 w-full rounded-2xl border border-white/12 bg-slate-950/55 px-4 text-sm text-white outline-none transition duration-300 placeholder:text-slate-500 focus:border-cyan-300/60 focus:bg-slate-950/80 focus:shadow-[0_0_0_4px_rgba(34,211,238,0.12)]"
          style={{ paddingLeft: Icon ? '3rem' : '1rem' }}
        />
      </div>
    </label>
  );
}

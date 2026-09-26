export default function Kpi({
  label,
  value,
  hint,
  warn,
}: {
  label: string
  value: number
  hint: string
  warn?: boolean
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-3">
      <p className="text-[11px] text-[var(--text-secondary)]">{label}</p>
      <p className={`mt-1 text-xl font-medium ${warn ? 'text-red-500' : 'text-[var(--text-primary)]'}`}>{value.toLocaleString('es-PE')}</p>
      <p className="text-[11px] text-[var(--text-secondary)]">{hint}</p>
    </div>
  )
}

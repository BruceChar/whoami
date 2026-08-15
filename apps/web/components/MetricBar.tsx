interface Props {
  label: string;
  value: number;
  up?: boolean;
  down?: boolean;
}

export default function MetricBar({ label, value, up, down }: Props) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  const color = up ? "bg-mirror" : down ? "bg-rose-400" : "bg-slate-400";
  return (
    <div className="mirror-card">
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-slate-300">{label}</span>
        <span className="text-lg font-semibold text-slate-100">{pct}%</span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-ink-800">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

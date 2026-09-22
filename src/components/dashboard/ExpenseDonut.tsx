interface Segment {
  label: string;
  value: number;
  color: string;
}

export function ExpenseDonut({ total, segments }: { total: string; segments: Segment[] }) {
  const sum = segments.reduce((s, seg) => s + seg.value, 0);
  const r = 40;
  const circumference = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="flex items-center gap-6">
      <div className="relative h-28 w-28 shrink-0">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          <circle cx="50" cy="50" r={r} fill="none" stroke="#EEF2FF" strokeWidth="10" />
          {segments.map((seg) => {
            const fraction = seg.value / sum;
            const dash = fraction * circumference;
            const el = (
              <circle
                key={seg.label}
                cx="50"
                cy="50"
                r={r}
                fill="none"
                stroke={seg.color}
                strokeWidth="10"
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
                strokeLinecap="round"
              />
            );
            offset += dash;
            return el;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-base font-semibold text-ink">{total}</div>
          <div className="text-[9px] font-medium uppercase tracking-wide text-faint">Total</div>
        </div>
      </div>
      <div className="space-y-2">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-2 text-sm">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: seg.color }} />
            <span className="text-body">{seg.label}</span>
            <span className="ml-auto font-medium text-ink">{seg.value.toLocaleString("en-IN")}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

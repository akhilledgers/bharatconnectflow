import { useEffect, useRef, useState } from "react";
import { compactINR } from "./overviewData";
import { fmtINR } from "./data";

const H = 150;
const PAD = { top: 10, right: 12, bottom: 22, left: 52 };

function niceTicks(min: number, max: number, count = 3) {
  const span = max - min || max || 1;
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= count) ?? raw;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(v);
  return ticks;
}

const dayLabel = (d: Date) => d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });

/** Single-series area: total cash in bank over the last 30 days. Hover shows the day's balance. */
export function BalanceTrend({ points }: { points: { date: Date; value: number }[] }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(240, entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const values = points.map((p) => p.value);
  const ticks = niceTicks(Math.min(...values) * 0.92, Math.max(...values) * 1.03);
  const yMin = ticks[0];
  const yMax = ticks[ticks.length - 1];
  const innerW = width - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (i / (points.length - 1)) * innerW;
  const y = (v: number) => PAD.top + (1 - (v - yMin) / (yMax - yMin)) * innerH;

  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join("");
  const area = `${line}L${x(points.length - 1).toFixed(1)},${PAD.top + innerH}L${PAD.left},${PAD.top + innerH}Z`;
  const last = points.length - 1;
  const xTicks = [0, Math.round(last / 2), last];

  const onMove = (clientX: number) => {
    const rect = wrap.current!.getBoundingClientRect();
    const i = Math.round(((clientX - rect.left - PAD.left) / innerW) * last);
    setHover(Math.min(last, Math.max(0, i)));
  };

  const h = hover ?? null;
  return (
    <div ref={wrap} className="relative select-none" onMouseLeave={() => setHover(null)}>
      <svg
        width={width}
        height={H}
        role="img"
        aria-label={`Cash in bank over the last 30 days, from ${fmtINR(points[0].value)} to ${fmtINR(points[last].value)}`}
        onMouseMove={(e) => onMove(e.clientX)}
        className="block"
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth={1} />
            <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-muted-foreground text-[11px] tabular-nums">
              {compactINR(t)}
            </text>
          </g>
        ))}
        {xTicks.map((i) => (
          <text
            key={i}
            x={x(i)}
            y={H - 4}
            textAnchor={i === 0 ? "start" : i === last ? "end" : "middle"}
            className="fill-muted-foreground text-[11px]"
          >
            {i === last ? "Today" : dayLabel(points[i].date)}
          </text>
        ))}
        <path d={area} fill="var(--primary)" fillOpacity={0.08} />
        <path d={line} fill="none" stroke="var(--primary)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {h !== null && <line x1={x(h)} x2={x(h)} y1={PAD.top} y2={PAD.top + innerH} stroke="var(--ring)" strokeDasharray="3 3" />}
        <circle cx={x(h ?? last)} cy={y(points[h ?? last].value)} r={4.5} fill="var(--primary)" stroke="var(--background)" strokeWidth={2} />
      </svg>
      {h !== null && (
        <div
          className="pointer-events-none absolute top-0 z-10 rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs shadow-md shadow-black/5"
          style={{ left: Math.min(Math.max(x(h) - 70, 0), width - 140), width: 140 }}
        >
          <div className="text-muted-foreground">{h === last ? "Today" : dayLabel(points[h].date)}</div>
          <div className="font-semibold tabular-nums text-foreground">{fmtINR(points[h].value)}</div>
        </div>
      )}
    </div>
  );
}

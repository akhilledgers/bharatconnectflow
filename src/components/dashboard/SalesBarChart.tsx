interface WeekBar {
  label: string;
  sales: number;
  payments: number;
}

const DATA: WeekBar[] = [
  { label: "23 Aug - 29 Aug", sales: 145000, payments: 0 },
  { label: "30 Aug - 05 Sept", sales: 65000, payments: 8000 },
  { label: "06 Sept - 12 Sept", sales: 145000, payments: 0 },
  { label: "13 Sept - 19 Sept", sales: 160000, payments: 0 },
  { label: "20 Sept - 21 Sept", sales: 0, payments: 0 },
];

const MAX = 160000;
const TICKS = [0, 40000, 80000, 120000, 160000];

export function SalesBarChart() {
  return (
    <div>
      <div className="flex h-40 items-stretch gap-4">
        <div className="flex flex-col justify-between py-1 text-right text-xs text-faint">
          {[...TICKS].reverse().map((t) => (
            <span key={t}>{t === 0 ? "0k" : `${t / 1000}k`}</span>
          ))}
        </div>
        <div className="relative flex flex-1 items-stretch justify-between gap-3 border-l border-gray-100">
          {TICKS.map((t) => (
            <div
              key={t}
              className="absolute left-0 right-0 border-t border-dashed border-gray-100"
              style={{ bottom: `${(t / MAX) * 100}%` }}
            />
          ))}
          {DATA.map((week) => (
            <div key={week.label} className="relative z-10 flex flex-1 items-end justify-center gap-0.5">
              <div
                className="w-3 rounded-t bg-blue-500"
                style={{ height: `${(week.sales / MAX) * 100}%` }}
                title={`Sales: ${week.sales.toLocaleString("en-IN")}`}
              />
              {week.payments > 0 && (
                <div
                  className="w-3 rounded-t bg-emerald-500"
                  style={{ height: `${(week.payments / MAX) * 100}%` }}
                  title={`Payments received: ${week.payments.toLocaleString("en-IN")}`}
                />
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-2 flex justify-between pl-8 text-[11px] text-faint">
        {DATA.map((week) => (
          <span key={week.label} className="flex-1 text-center">
            {week.label}
          </span>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-4 pl-8 text-xs text-body">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-blue-500" /> Sales
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-500" /> Payments Received
        </span>
      </div>
    </div>
  );
}

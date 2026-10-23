import { useNavigate } from "react-router-dom";
import { DIFF_LABEL, octoberSepPending, useHrmsStore, type ReviewRow } from "../../../store/useHrmsStore";
import { ToggleGroup } from "../../../components/ui/tabs";
import { REVISION_MONTH } from "../payroll";
import { num } from "../months";

// October 2026 — the first month on the new ceiling. While September still stands on the old ceiling, the
// one-time choice of adding its difference sits on the computation page and the table updates as it
// changes; Run Payroll saves it. Higher employer PF always increases CTC — the CTC column shows the old one.

export function OctoberPlanCard({ rows }: { rows: ReviewRow[] }) {
  const navigate = useNavigate();
  const state = useHrmsStore();
  const { octPlan, setOctPlan } = state;
  if (!octoberSepPending(state)) return null;

  const diffTotal = rows.reduce(
    (t, r) => t + (r.record?.deductions.filter((d) => d.name === DIFF_LABEL).reduce((x, d) => x + d.amount, 0) ?? 0) + (r.record?.recoveryHeldBack ?? 0),
    0,
  );

  return (
    <div className="mb-5 divide-y divide-border rounded-xl border border-border bg-card shadow-xs shadow-black/5">
      <Row
        title="September difference"
        control={
          <ToggleGroup<"add" | "skip">
            value={octPlan.sepDifference}
            onChange={(v) => setOctPlan({ sepDifference: v })}
            items={[
              { value: "add", label: "Add to October" },
              { value: "skip", label: "Don't add" },
            ]}
          />
        }
        note={
          octPlan.sepDifference === "add" ? (
            <>₹{num(diffTotal)} PF for 17–30 Sep, shown in Deductions.</>
          ) : (
            <>
              September stays on the old ceiling.{" "}
              <button className="cursor-pointer text-primary hover:underline" onClick={() => navigate(`/hrms/payroll/computation?month=${REVISION_MONTH}`)}>
                Re-run September instead
              </button>
            </>
          )
        }
      />
      <div className="px-4 py-2 text-[11px] text-muted-foreground">One-time, for the new PF ceiling. Saved when you run October payroll.</div>
    </div>
  );
}

function Row({ title, control, note }: { title: string; control: React.ReactNode; note: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
      <div className="w-44 text-sm font-semibold text-foreground">{title}</div>
      {control}
      <div className="text-xs text-muted-foreground">{note}</div>
    </div>
  );
}

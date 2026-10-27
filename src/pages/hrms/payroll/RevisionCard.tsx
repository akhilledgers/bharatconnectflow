import { useNavigate } from "react-router-dom";
import { CheckCircle2, Circle, Download } from "lucide-react";
import { useHrmsStore } from "../../../store/useHrmsStore";
import { Button } from "../../../components/ui/button";
import { NEW_CEILING, OLD_CEILING, REVISION_MONTH } from "../payroll";
import { fmtDate, num } from "../months";
import { FIRST_FULL_MONTH, coverageRows, ctcRows, septemberStatus } from "../revision";
import { panelCls } from "../shared";
import type { ReactNode } from "react";

// Read-only summary of the PF wage-ceiling revision on the Payroll Dashboard. Nothing is done here —
// each line says where it happened (September run, October run) and links there. Disappears from view
// only by being complete; it stays as the audit trail.

export function RevisionCard() {
  const navigate = useNavigate();
  const sepRun = useHrmsStore((s) => s.runs[REVISION_MONTH]);
  const correction = useHrmsStore((s) => s.sepCorrection);
  const hasDiffs = useHrmsStore((s) => s.pfDifferences.length > 0);
  const employees = useHrmsStore((s) => s.employees);
  const salaries = useHrmsStore((s) => s.salaries);
  const octoberRun = useHrmsStore((s) => s.runs[FIRST_FULL_MONTH]);

  const sep = septemberStatus(sepRun, correction);
  const coverage = coverageRows(employees, salaries);
  const recorded = coverage.filter((c) => c.recorded);
  const noUan = coverage.filter((c) => !c.employee.uan);
  const ctcUp = ctcRows(employees, salaries).length;

  const downloadCoverage = () => {
    const lines = [
      ["Employee ID", "Name", "Change", "From", "PF wage on 17 Sep", "UAN", "Recorded"],
      ...coverage.map((c) => [
        c.employee.employeeId,
        c.employee.name,
        [c.pf && "PF", c.eps && "Pension (EPS)"].filter(Boolean).join(" + "),
        fmtDate(c.start),
        c.wageOnRevision,
        c.employee.uan ?? "Missing — excluded from ECR",
        c.recorded ? "Yes" : "At next run",
      ]),
    ];
    const blob = new Blob([lines.map((l) => l.map((x) => `"${x}"`).join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "PF-coverage-from-17-Sep-2026.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className={`${panelCls} mb-5`}>
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <div>
          <div className="text-sm font-semibold">PF wage ceiling revision</div>
          <div className="text-xs text-muted-foreground">
            ₹{num(OLD_CEILING)} → ₹{num(NEW_CEILING)} from 17 Sep 2026
          </div>
        </div>
      </div>
      <div className="divide-y divide-border">
        <Line
          done={sep === "rerun"}
          title="September"
          text={
            sep === "rerun"
              ? `Re-run on the new ceiling.${hasDiffs ? ` The difference goes to ${FIRST_FULL_MONTH}.` : ""}`
              : sep === "not_run"
                ? "Not run yet."
                : `Paid on the old ceiling. Re-run September; if salaries were already paid, the difference is recovered in ${FIRST_FULL_MONTH}.`
          }
          action={
            sep === "old" && (
              <Button size="sm" onClick={() => navigate(`/hrms/payroll/computation?month=${REVISION_MONTH}`)}>
                Open September
              </Button>
            )
          }
        />
        <Line
          done={coverage.length > 0 && recorded.length === coverage.length}
          title="Newly under PF or pension"
          text={
            coverage.length === 0
              ? "Nobody's PF or pension status changes."
              : `${coverage.length} employee(s) from 17 Sep — ${recorded.length === coverage.length ? "recorded" : "recorded by the next September or October run"}.${
                  noUan.length ? ` ${noUan.length} without a UAN, left out of the ECR until one is added.` : ""
                }`
          }
          action={
            coverage.length > 0 && (
              <Button size="sm" variant="ghost" onClick={downloadCoverage}>
                <Download /> List
              </Button>
            )
          }
        />
        <Line
          done={ctcUp > 0 && !!octoberRun}
          title="October CTC"
          text={
            ctcUp === 0
              ? "No change in employer PF."
              : octoberRun
                ? `CTC increased for ${ctcUp} employee(s) from ${FIRST_FULL_MONTH} with the higher employer PF.`
                : `Employer PF goes up for ${ctcUp} employee(s) — their CTC increases from ${FIRST_FULL_MONTH}.`
          }
        />
      </div>
    </div>
  );
}

function Line({ done, title, text, action }: { done: boolean; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-5 py-3">
      {done ? <CheckCircle2 className="size-4 shrink-0 text-green-600" /> : <Circle className="size-4 shrink-0 text-muted-foreground" />}
      <div className="min-w-0 flex-1">
        <span className="text-sm font-medium">{title}</span>
        <span className="ms-2 text-sm text-muted-foreground">{text}</span>
      </div>
      {action}
    </div>
  );
}

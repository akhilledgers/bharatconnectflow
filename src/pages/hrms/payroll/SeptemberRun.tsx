import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { AlertTriangle, ArrowRight, CheckCircle2, Download, Info } from "lucide-react";
import { septemberImpact, useHrmsStore } from "../../../store/useHrmsStore";
import { Button } from "../../../components/ui/button";
import { Dialog } from "../../../components/ui/dialog";
import { Callout } from "../../../components/ui/popover";
import { ToggleGroup } from "../../../components/ui/tabs";
import { cn } from "../../../lib/cn";
import { NEW_CEILING, OLD_CEILING, REVISION_MONTH } from "../payroll";
import { addMonths, fmtDate, num } from "../months";
import { septemberStatus } from "../revision";
import type { PaidAnswer, SepBasis } from "../types";

// September 2026 — the month the PF wage ceiling changed (₹15,000 → ₹25,000 from 17 Sep).
// The computation page gets a basis selector (one basis for the month) and split payable days; Run
// Payroll asks only "Already paid?".

const BASIS_NOTE: Record<SepBasis, string> = {
  mid_month: `₹${num(OLD_CEILING)} for 1–16 Sep, ₹${num(NEW_CEILING)} from 17 Sep, as EPFO advises.`,
  old: `₹${num(OLD_CEILING)} for the whole month — only if PF was actually deposited this way.`,
};

/** Header card on the September computation page. */
export function SeptemberBasisCard() {
  const basis = useHrmsStore((s) => s.sepBasis);
  const setBasis = useHrmsStore((s) => s.setSepBasis);
  const run = useHrmsStore((s) => s.runs[REVISION_MONTH]);
  const dismissed = useHrmsStore((s) => s.sepReminderDismissed);
  const dismiss = useHrmsStore((s) => s.dismissSepReminder);
  const correction = useHrmsStore((s) => s.sepCorrection);
  const hasDiffs = useHrmsStore((s) => s.pfDifferences.length > 0);
  const status = septemberStatus(run, correction);
  const runOnOld = status === "old";
  const [changing, setChanging] = useState(false);

  // Once September is corrected the choice is made — show what happened, with a way to change it.
  if ((status === "rerun" || status === "in_october") && !changing)
    return (
      <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-border bg-card px-4 py-3 text-sm shadow-xs shadow-black/5">
        <CheckCircle2 className="size-4 text-green-600" />
        <span className="font-semibold text-foreground">September PF ceiling</span>
        <span className="text-muted-foreground">
          {status === "rerun"
            ? `Corrected on mid-month basis on ${fmtDate(run!.runOn)}.${hasDiffs ? " Difference goes to October." : ""}`
            : "Kept as paid; the difference was added to October."}
        </span>
        <Button variant="link" size="sm" onClick={() => setChanging(true)}>
          Change
        </Button>
      </div>
    );

  return (
    <div className="mb-5 space-y-3">
      {runOnOld && !dismissed && <SeptemberReminder onDismiss={dismiss} />}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-border bg-card px-4 py-3 shadow-xs shadow-black/5">
        <div className="text-sm font-semibold text-foreground">September PF ceiling</div>
        <ToggleGroup<SepBasis>
          value={basis}
          onChange={setBasis}
          items={[
            { value: "mid_month", label: "Mid-month change (recommended)" },
            { value: "old", label: "Old ceiling, full month" },
          ]}
        />
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Info className="size-3.5 shrink-0" />
          {BASIS_NOTE[basis]}
        </div>
      </div>
    </div>
  );
}

export function SeptemberReminder({ onDismiss, onOpen }: { onDismiss: () => void; onOpen?: () => void }) {
  return (
    <Callout
      tone="warning"
      icon={<AlertTriangle className="size-5 text-amber-600" />}
      title="September PF was calculated on the old ₹15,000 ceiling"
      actions={
        <>
          <Button size="sm" variant="ghost" onClick={onDismiss}>
            Dismiss
          </Button>
          {onOpen && (
            <Button size="sm" variant="primary" onClick={onOpen}>
              Review September <ArrowRight />
            </Button>
          )}
        </>
      }
    >
      The ceiling became ₹25,000 from 17 Sep 2026. Re-run September to correct it, or add the difference when you run October payroll.
    </Callout>
  );
}

const PAID_OPTIONS: { value: PaidAnswer; title: string; sub: string }[] = [
  { value: "not_paid", title: "Not paid yet", sub: "Pay on these figures." },
  { value: "paid_as_here", title: "Paid as calculated here", sub: "Update records only." },
  { value: "paid_old", title: "Paid on the old ceiling", sub: "Recover the difference in October." },
];

/**
 * Run Payroll for September asks one thing the page can't know — was September already paid? The
 * before → after is on the page itself (struck-out old PF and payout); the full list is a download.
 */
export function SeptemberRunDialog({ employeeIds, onClose }: { employeeIds: string[]; onClose: () => void }) {
  const navigate = useNavigate();
  const state = useHrmsStore();
  const { runPayroll } = state;
  const [rows] = useState(() => septemberImpact(state, employeeIds));
  const runOnOld = (state.runs[REVISION_MONTH]?.sepBasis ?? "old") === "old";
  const [answer, setAnswer] = useState<PaidAnswer>(rows.some((r) => r.paid && r.wasRun) ? (runOnOld ? "paid_old" : "paid_as_here") : "not_paid");

  const changed = rows.filter((r) => r.after.employeePf !== r.before.employeePf);
  const pfUp = changed.reduce((t, r) => t + r.after.employeePf - r.before.employeePf, 0);
  // Exited employees have no October salary to recover from — the employer pays their share.
  const payers = Object.fromEntries(rows.map((r) => [r.employee.id, r.employee.dateOfExit ? ("employer" as const) : ("employee" as const)]));

  const download = () => {
    const head = ["Employee ID", "Name", "Employee PF before", "Employee PF after", "Employer PF after", "EPS after", "Net pay before", "Net pay after"];
    const lines = rows.map((r) => [r.employee.employeeId, r.employee.name, r.before.employeePf, r.after.employeePf, r.after.employerPf, r.after.eps, r.before.payout, r.after.payout]);
    const blob = new Blob([[head, ...lines].map((l) => l.map((x) => `"${x}"`).join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "September-2026-PF-impact.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const confirm = () => {
    const res = runPayroll(REVISION_MONTH, employeeIds, { paidAnswer: answer, payers });
    toast.success("September payroll updated", {
      description: `Updated ${res.updated} · No changes ${res.unchanged}${res.inserted ? ` · Inserted ${res.inserted}` : ""}${
        answer === "paid_old" && changed.length ? ` · Difference goes to ${addMonths(REVISION_MONTH, 1)}` : ""
      }`,
    });
    onClose();
    navigate(`/hrms/reports/monthly-pay?month=${REVISION_MONTH}`);
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title="Run September payroll"
      description={changed.length ? `PF changes for ${changed.length} employee(s), +₹${num(pfUp)} employee PF in total.` : "No PF changes."}
      footer={
        <>
          <Button variant="link" className="me-auto text-xs" onClick={download}>
            <Download /> Download details
          </Button>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={confirm}>
            Run payroll
          </Button>
        </>
      }
    >
      <div className="space-y-2">
        <div className="text-sm font-medium">Were September salaries already paid?</div>
        {PAID_OPTIONS.map((o) => (
          <label
            key={o.value}
            className={cn("flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2", answer === o.value ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40")}
          >
            <input type="radio" className="accent-primary" checked={answer === o.value} onChange={() => setAnswer(o.value)} />
            <span className="text-sm text-foreground">{o.title}</span>
            <span className="text-xs text-muted-foreground">— {o.sub}</span>
          </label>
        ))}
      </div>
    </Dialog>
  );
}


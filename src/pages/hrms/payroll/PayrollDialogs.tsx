import { useState } from "react";
import { Button } from "../../../components/ui/button";
import { Dialog } from "../../../components/ui/dialog";
import { FormItem, Input, Label, Select, Textarea } from "../../../components/ui/input";
import { payableHalvesFor, useHrmsStore } from "../../../store/useHrmsStore";
import { lopDays } from "../attendance";
import { employedDays, employedDaysBetween, pfSegments, splitPayable } from "../payroll";
import type { Employee, MonthKey } from "../types";

// Pop-ups on the Payroll Computation page: Payable Days, Assign branch, Benefit / Deduction.

const round2 = (n: number) => Math.round(n * 100) / 100;

export function PayableDaysDialog({ employee, month, current, onClose }: { employee: Employee; month: MonthKey; current: number; onClose: () => void }) {
  const state = useHrmsStore();
  const { absences, setPayableDays } = state;
  const savedReason = state.payableReasons[month]?.[employee.id];
  const employed = employedDays(employee, month);
  const lop = lopDays(employee, month, absences);
  const segs = pfSegments(month);
  const split = segs.length > 1;
  const employedBySeg = segs.map((s) => employedDaysBetween(employee, month, s.from, s.to));
  const [days, setDays] = useState(String(round2(current)));
  const [halves, setHalves] = useState(() => payableHalvesFor(state, employee, month).map((d) => String(round2(d))));
  const [halvesEdited, setHalvesEdited] = useState(!!state.payableHalves[month]?.[employee.id]);
  const [reason, setReason] = useState(
    savedReason ??
      `There are total payable days ${round2(current)}. Employed ${employed} day(s) this month, ${lop} loss-of-pay absence(s) in attendance. Total worked days ${Math.max(0, employed - lop)}.`,
  );
  const value = Number(days);
  const halfValues = halves.map(Number);
  // v4 accepts anything here (Demo Ledgers has 31 payable days in a 30-day September). September is
  // validated: each half within the days employed in it, halves adding up to the total.
  const over = value > employed;
  const halfOver = halfValues.map((h, i) => h > employedBySeg[i] || h < 0);
  const mismatch = split && Math.abs(halfValues.reduce((t, h) => t + h, 0) - value) > 0.01;
  const invalid = days === "" || value < 0 || (split && (over || halfOver.some(Boolean) || mismatch));

  /** Changing the total re-spreads it across halves by employed days, until the halves are edited by hand. */
  const onTotal = (v: string) => {
    setDays(v);
    if (split && !halvesEdited) setHalves(splitPayable(Number(v) || 0, employedBySeg).map((d) => String(round2(d))));
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title="Payable Days"
      footer={
        <>
          <Button variant="ghost" className="text-destructive" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="success"
            disabled={invalid}
            onClick={() => {
              setPayableDays(month, employee.id, value, reason, split && halvesEdited ? halfValues : undefined);
              onClose();
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <FormItem>
        <Label>Total Payable Days</Label>
        <Input type="number" min={0} step={0.5} value={days} onChange={(e) => onTotal(e.target.value)} />
        {over && (
          <p className={`text-xs ${split ? "text-destructive" : "text-amber-600"}`}>
            More than the {employed} day(s) {employee.name} was employed this month.
          </p>
        )}
      </FormItem>
      {split && (
        <div className="space-y-2 rounded-lg border border-border p-3">
          <div className="text-xs font-medium text-foreground">Split for the PF ceiling change</div>
          <div className="grid grid-cols-2 gap-3">
            {segs.map((s, i) => (
              <FormItem key={s.label}>
                <Label>
                  {s.label} <span className="font-normal text-muted-foreground">(employed {employedBySeg[i]})</span>
                </Label>
                <Input
                  type="number"
                  min={0}
                  step={0.5}
                  aria-invalid={halfOver[i] || undefined}
                  value={halves[i]}
                  onChange={(e) => {
                    setHalvesEdited(true);
                    setHalves(halves.map((h, j) => (j === i ? e.target.value : h)));
                  }}
                />
              </FormItem>
            ))}
          </div>
          {halfOver.some(Boolean) && <p className="text-xs text-destructive">A half can't exceed the days employed in it.</p>}
          {mismatch && <p className="text-xs text-destructive">The halves must add up to the total payable days.</p>}
          <p className="text-[11px] text-muted-foreground">
            {halvesEdited ? "Edited by hand." : "Loss of pay is spread across the halves in proportion to days employed. Edit a half to place it exactly."}
          </p>
        </div>
      )}
      <FormItem>
        <Label>Reason</Label>
        <Textarea rows={4} value={reason} onChange={(e) => setReason(e.target.value)} />
      </FormItem>
    </Dialog>
  );
}

export function AssignBranchDialog({ employee, onClose }: { employee: Employee; onClose: () => void }) {
  const branches = useHrmsStore((s) => s.branches);
  const update = useHrmsStore((s) => s.updateEmployee);
  const [branchId, setBranchId] = useState("");
  return (
    <Dialog
      open
      onClose={onClose}
      title="Assign branch"
      description={`${employee.employeeId} · ${employee.name}`}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!branchId}
            onClick={() => {
              update(employee.id, { branchId });
              onClose();
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <FormItem>
        <Label>Branch</Label>
        <Select value={branchId} onChange={(e) => setBranchId(e.target.value)}>
          <option value="">Select branch</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </Select>
      </FormItem>
    </Dialog>
  );
}

const BENEFIT_TYPES = ["Bonus", "Incentive", "Arrears", "Overtime", "Reimbursement"];
const DEDUCTION_TYPES = ["LWF", "Late checking", "Advance recovery", "Loan EMI", "Insurance", "Other"];

export function OneTimeDialog({ employee, month, kind, onClose }: { employee: Employee; month: MonthKey; kind: "benefits" | "deductions"; onClose: () => void }) {
  const addOneTime = useHrmsStore((s) => s.addOneTime);
  const types = kind === "benefits" ? BENEFIT_TYPES : DEDUCTION_TYPES;
  const [name, setName] = useState(types[0]);
  const [amount, setAmount] = useState("");
  return (
    <Dialog
      open
      onClose={onClose}
      title={kind === "benefits" ? "Add Benefit" : "Add Deduction"}
      description={`${employee.name} · ${month} only`}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!Number(amount)}
            onClick={() => {
              addOneTime(month, employee.id, kind, { name, amount: Number(amount) });
              onClose();
            }}
          >
            Add
          </Button>
        </>
      }
    >
      <FormItem>
        <Label>Type</Label>
        <Select value={name} onChange={(e) => setName(e.target.value)}>
          {types.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </Select>
      </FormItem>
      <FormItem>
        <Label>Amount</Label>
        <Input type="number" placeholder="INR 0" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </FormItem>
    </Dialog>
  );
}

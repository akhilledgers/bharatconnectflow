import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Info, Plus, X } from "lucide-react";
import { useHrmsStore } from "../../store/useHrmsStore";
import { Button } from "../../components/ui/button";
import { Dialog } from "../../components/ui/dialog";
import { Checkbox, Input, Label, Select } from "../../components/ui/input";
import { Callout, popoverCls } from "../../components/ui/popover";
import { tableCls, tdCls, thCls } from "../../components/ui/table";
import { cn } from "../../lib/cn";
import {
  COMPONENT_CATALOG,
  NEW_CEILING,
  OLD_CEILING,
  PF_BASIS_LABEL,
  REVISION_MONTH,
  coveredStructure,
  isNewlyCovered,
  monthlyPfWage,
  salaryFor,
  pfLimitLabel,
  defaultSplit,
  latestSalary,
  setupCtc,
  setupEsi,
  setupPf,
  structureGross,
} from "./payroll";
import { CURRENT_MONTH, compareMonths, inr, monthKey, num, parseMonth } from "./months";
import { FIRST_FULL_MONTH } from "./revision";
import type { Employee, PfBasis, PfLimit, SalaryComponent, SalaryStructure } from "./types";

// v4 Salary Setup tab. Gross + Effective Date (month only), Basic Pay (Set Zero Basic), DIRECT BENEFITS
// with Add Components (each Fixed-Prorated / Fixed-Standard + "Include in PF wages"), RETIREMENT &
// INSURANCE (PF basis + cap, ESI), Salary Summary, Set Salary.
//
// Typing a gross applies LEDGERS' default split (Basic 50%, HRA 30% of Basic, rest Special); editing a
// component instead re-totals the gross, as v4 does.

type Draft = Omit<SalaryStructure, "id" | "createdOn">;

function toInputMonth(key: string): string {
  const { year, monthIndex } = parseMonth(key);
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
}
function fromInputMonth(v: string): string {
  const [y, m] = v.split("-").map(Number);
  return monthKey(y, m - 1);
}

export function SalarySetupTab({ employee }: { employee: Employee }) {
  const salaries = useHrmsStore((s) => s.salaries);
  const setSalary = useHrmsStore((s) => s.setSalary);
  const existing = latestSalary(salaries, employee.id);
  const history = useMemo(
    () => salaries.filter((s) => s.employeeId === employee.id).sort((a, b) => compareMonths(b.effectiveFrom, a.effectiveFrom)),
    [salaries, employee.id],
  );

  const [draft, setDraft] = useState<Draft | null>(() => (existing ? { ...existing, components: existing.components.map((c) => ({ ...c })) } : null));
  const [effective, setEffective] = useState(existing?.effectiveFrom ?? CURRENT_MONTH);
  const [grossInput, setGrossInput] = useState(existing ? String(existing.gross) : "");
  const [adding, setAdding] = useState(false);
  const [newType, setNewType] = useState("");

  const applyGross = (raw: string) => {
    setGrossInput(raw);
    const gross = Number(raw) || 0;
    if (!gross) return setDraft(null);
    const split = defaultSplit(gross);
    setDraft((d) => ({
      employeeId: employee.id,
      effectiveFrom: effective,
      gross,
      basic: split.basic,
      zeroBasic: false,
      components: split.components,
      pfBasis: d?.pfBasis ?? "none",
      pfLimit: d?.pfLimit ?? "no_limit",
      esiEnabled: d?.esiEnabled ?? false,
    }));
  };

  /** Any edit below the gross re-totals it. */
  const edit = (patch: Partial<Draft>) =>
    setDraft((d) => {
      if (!d) return d;
      const next = { ...d, ...patch };
      next.gross = structureGross(next);
      setGrossInput(String(next.gross));
      return next;
    });
  const editComponent = (key: string, patch: Partial<SalaryComponent>) => edit({ components: draft!.components.map((c) => (c.key === key ? { ...c, ...patch } : c)) });

  // PF and CTC are shown at the ceiling in force now (or in the effective month, if that's later).
  const viewMonth = compareMonths(effective, CURRENT_MONTH) > 0 ? effective : CURRENT_MONTH;
  const pf = draft ? setupPf(draft, viewMonth) : 0;
  const esi = draft ? setupEsi(draft) : 0;
  const ctc = draft ? setupCtc(draft, viewMonth) : 0;
  const available = COMPONENT_CATALOG.filter((c) => !draft?.components.some((x) => x.key === c.key));

  // PF wage ceiling revision. NO-PF is only allowed above the ceiling; within it PF is mandatory. A
  // structure applies from its month onward, so one saved today is in force on the new ceiling.
  const wageIfCovered = draft ? monthlyPfWage(coveredStructure(draft, true)) : 0;
  const pfMandatory = !!draft && draft.pfBasis === "none" && wageIfCovered <= NEW_CEILING;
  const comesUnderPf = pfMandatory && existing?.pfBasis === "none" && isNewlyCovered(employee, salaryFor(salaries, employee.id, REVISION_MONTH));
  const [confirmNoPf, setConfirmNoPf] = useState(false);
  const switchToPf = () => {
    edit({ pfBasis: "basic", pfLimit: "limit" });
    if (compareMonths(effective, FIRST_FULL_MONTH) < 0) setEffective(FIRST_FULL_MONTH);
  };

  const save = (force = false) => {
    if (!draft) return;
    if (pfMandatory && !force) return setConfirmNoPf(true);
    setConfirmNoPf(false);
    setSalary({ ...draft, effectiveFrom: effective });
    toast.success("Salary setup completed successfully.");
  };

  return (
    <div className="space-y-5">
      {comesUnderPf && (
        <Callout
          tone="primary"
          icon={<Info className="size-5 text-blue-600" />}
          title="Comes under PF from 17 Sep 2026"
          actions={
            <Button size="sm" variant="primary" onClick={switchToPf}>
              Use 12%-Basic from {FIRST_FULL_MONTH}
            </Button>
          }
        >
          PF wage ₹{num(wageIfCovered)} is within the ₹{num(NEW_CEILING)} ceiling. Payroll already applies 12%-Basic, limited to the PF ceiling; this salary moves to it at the
          next payroll run.
        </Callout>
      )}
      <div className="grid grid-cols-2 gap-5">
        <div className="space-y-2">
          <Label>Gross</Label>
          <Input type="number" placeholder="Enter gross salary" value={grossInput} onChange={(e) => applyGross(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label required>Effective Date</Label>
          <Input type="month" value={toInputMonth(effective)} onChange={(e) => e.target.value && setEffective(fromInputMonth(e.target.value))} />
          {effective === REVISION_MONTH && draft && draft.pfBasis !== "none" && (
            <p className="flex items-start gap-1 text-[11px] text-muted-foreground">
              <Info className="mt-px size-3 shrink-0" />
              September PF is worked out per half in payroll (₹{num(OLD_CEILING)} to 16 Sep, ₹{num(NEW_CEILING)} from 17 Sep). PF and CTC here are at the current ceiling.
            </p>
          )}
        </div>
      </div>

      {!draft ? (
        <div className="py-12 text-center text-sm text-muted-foreground">No salary set for this employee!</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label>Basic Pay</Label>
              <label className="flex h-8.5 items-center gap-2 text-sm">
                <Checkbox checked={draft.zeroBasic} onChange={(e) => edit({ zeroBasic: e.target.checked, basic: e.target.checked ? 0 : draft.basic })} />
                Set Zero Basic
              </label>
            </div>
            <div className="space-y-2">
              <Label>Basic Salary</Label>
              <Input type="number" placeholder="Basic" disabled={draft.zeroBasic} value={draft.basic} onChange={(e) => edit({ basic: Number(e.target.value) || 0 })} />
            </div>
          </div>

          <Section
            title="DIRECT BENEFITS"
            action={
              <div className="relative">
                <Button variant="primary" size="sm" onClick={() => setAdding(!adding)} disabled={available.length === 0}>
                  <Plus /> Add Components
                </Button>
                {adding && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setAdding(false)} />
                    <div className={`absolute right-0 z-20 mt-1 w-64 space-y-3 p-4 ${popoverCls}`}>
                      <div className="text-sm font-medium">Add New Benefits</div>
                      <div className="space-y-2">
                        <Label>Type</Label>
                        <Select value={newType} onChange={(e) => setNewType(e.target.value)}>
                          <option value="">Select</option>
                          {available.map((c) => (
                            <option key={c.key} value={c.key}>
                              {c.name}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button size="sm" onClick={() => setAdding(false)}>
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          variant="primary"
                          disabled={!newType}
                          onClick={() => {
                            const c = COMPONENT_CATALOG.find((x) => x.key === newType)!;
                            edit({ components: [...draft.components, { key: c.key, name: c.name, amount: 0, pay: "prorated", inPfWages: false }] });
                            setNewType("");
                            setAdding(false);
                          }}
                        >
                          + Add
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            }
          >
            {draft.components.map((c) => (
              <div key={c.key} className="flex items-center gap-4 border-b border-border px-4 py-3 last:border-b-0">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-foreground">{c.name}</div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                    {(["prorated", "standard"] as const).map((p) => (
                      <label key={p} className="flex cursor-pointer items-center gap-1.5">
                        <input type="radio" className="accent-primary" checked={c.pay === p} onChange={() => editComponent(c.key, { pay: p })} />
                        {p === "prorated" ? "Fixed-Prorated" : "Fixed-Standard"}
                      </label>
                    ))}
                    <label
                      className={cn("flex items-center gap-1.5", draft.pfBasis === "basic" ? "cursor-pointer" : "opacity-50")}
                      title={draft.pfBasis === "basic" ? undefined : "Applies when PF is 12%-Basic"}
                    >
                      <Checkbox
                        className="size-3.5"
                        disabled={draft.pfBasis !== "basic"}
                        checked={c.inPfWages}
                        onChange={(e) => editComponent(c.key, { inPfWages: e.target.checked })}
                      />
                      Include in PF wages
                    </label>
                  </div>
                </div>
                <Input type="number" className="!w-36 shrink-0" value={c.amount} onChange={(e) => editComponent(c.key, { amount: Number(e.target.value) || 0 })} />
                <button
                  aria-label={`Remove ${c.name}`}
                  className="cursor-pointer rounded p-1 text-muted-foreground hover:bg-muted"
                  onClick={() => edit({ components: draft.components.filter((x) => x.key !== c.key) })}
                >
                  <X className="size-4" />
                </button>
              </div>
            ))}
            {draft.components.length === 0 && <div className="px-4 py-4 text-sm text-muted-foreground">No components added.</div>}
          </Section>

          <Section title="RETIREMENT & INSURANCE">
            <div className="flex items-center gap-4 border-b border-border px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-foreground">Provident Fund (PF)</div>
                <div className="mt-1.5 flex items-center gap-2">
                  <Select selectSize="sm" wrapperClassName="w-52" value={draft.pfBasis} onChange={(e) => edit({ pfBasis: e.target.value as PfBasis })}>
                    {(Object.keys(PF_BASIS_LABEL) as PfBasis[]).map((k) => (
                      <option key={k} value={k}>
                        {PF_BASIS_LABEL[k]}
                      </option>
                    ))}
                  </Select>
                  {draft.pfBasis !== "none" && (
                    <Select selectSize="sm" wrapperClassName="w-60" value={draft.pfLimit} onChange={(e) => edit({ pfLimit: e.target.value as PfLimit })}>
                      {(["no_limit", "limit"] as PfLimit[]).map((k) => (
                        <option key={k} value={k}>
                          {pfLimitLabel(k, viewMonth)}
                        </option>
                      ))}
                    </Select>
                  )}
                </div>
              </div>
              <Input readOnly className="!w-36 shrink-0" value={num(pf)} />
              <span className="w-6" />
            </div>
            <div className="flex items-center gap-4 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-foreground">Employee State Insurance (ESI)</div>
                <label className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Checkbox className="size-3.5" checked={draft.esiEnabled} onChange={(e) => edit({ esiEnabled: e.target.checked })} />
                  Set ESI value
                  {draft.esiEnabled && draft.gross > 21000 && <span className="text-amber-600">· Gross above ₹21,000 — ESI not applicable</span>}
                </label>
              </div>
              <Input readOnly className="!w-36 shrink-0" value={num(esi)} />
              <span className="w-6" />
            </div>
          </Section>

          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
            <div className="mb-3 text-sm font-semibold text-foreground">Salary Summary</div>
            <SummaryRow label="Gross Total" value={inr(draft.gross)} />
            <SummaryRow label="CTC per Month" value={inr(ctc)} />
            <SummaryRow label="Total CTC (Per Annum)" value={inr(ctc * 12)} bold />
          </div>

          <div className="flex justify-end">
            <Button variant="primary" onClick={() => save()}>
              Set Salary
            </Button>
          </div>
          {confirmNoPf && (
            <Dialog
              open
              onClose={() => setConfirmNoPf(false)}
              title={`PF is mandatory up to ₹${num(NEW_CEILING)}`}
              description={`This salary has a PF wage of ₹${num(wageIfCovered)} but is set to NO-PF. Since 17 Sep 2026, employees within the ₹${num(NEW_CEILING)} ceiling must be in PF.`}
              footer={
                <>
                  <Button onClick={() => save(true)}>Save as NO-PF anyway</Button>
                  <Button
                    variant="primary"
                    onClick={() => {
                      switchToPf();
                      setConfirmNoPf(false);
                    }}
                  >
                    Use 12%-Basic
                  </Button>
                </>
              }
            >
              <p className="text-xs text-muted-foreground">Save anyway only if this employee is lawfully excluded — for example an international worker covered elsewhere.</p>
            </Dialog>
          )}
        </>
      )}

      {history.length > 0 && (
        <div>
          <div className="mb-2 text-sm font-medium text-foreground">Salary revisions</div>
          <div className="overflow-hidden rounded-lg border border-border">
            <table className={tableCls}>
              <thead>
                <tr className="bg-muted/40">
                  <th className={thCls}>Effective from</th>
                  <th className={thCls}>Gross</th>
                  <th className={thCls}>Basic</th>
                  <th className={thCls}>PF</th>
                  <th className={thCls}>CTC / month</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id}>
                    <td className={tdCls}>
                      {h.effectiveFrom}
                      {h.reason && <div className="text-[11px] text-muted-foreground">{h.reason}</div>}
                    </td>
                    <td className={tdCls}>{inr(h.gross)}</td>
                    <td className={tdCls}>{inr(h.basic)}</td>
                    <td className={tdCls}>
                      {PF_BASIS_LABEL[h.pfBasis]}
                      {h.pfBasis !== "none" && <span className="text-muted-foreground"> · {pfLimitLabel(h.pfLimit, h.effectiveFrom)}</span>}
                    </td>
                    <td className={tdCls}>{inr(setupCtc(h, h.effectiveFrom))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="overflow-visible rounded-xl border border-border">
      <div className="flex items-center justify-between rounded-t-xl bg-blue-50 px-4 py-2.5">
        <span className="text-xs font-semibold tracking-wide text-foreground">{title}</span>
        {action}
      </div>
      <div>{children}</div>
    </div>
  );
}

function SummaryRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={cn("flex justify-between py-1 text-sm", bold && "font-semibold")}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

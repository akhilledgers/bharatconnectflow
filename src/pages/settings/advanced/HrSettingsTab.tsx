import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Check, CalendarDays, MoreHorizontal, RefreshCw, Search, Settings2, SquarePlus } from "lucide-react";
import { useHrmsStore } from "../../../store/useHrmsStore";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Sheet } from "../../../components/ui/dialog";
import { Input, Label, Select } from "../../../components/ui/input";
import { menuItemCls, popoverCls } from "../../../components/ui/popover";
import { ToggleGroup } from "../../../components/ui/tabs";
import { tableCls, tdCls, thCls, trCls } from "../../../components/ui/table";
import { cn } from "../../../lib/cn";
import { LEAVE_TYPES } from "../../hrms/data";
import { TODAY } from "../../hrms/months";
import type { LeaveAllocation, LeavePolicy } from "../../hrms/types";

// v4 Advanced Settings → HR: "Basic" (employer PF / ESI registration numbers, payroll cycle,
// authorised IPs for attendance, check-in location, employment agreement) and "Leaves" (leave
// policies with Create New Policy drawer).

export function HrSettingsTab() {
  const [sub, setSub] = useState<"basic" | "leaves">("basic");
  return (
    <div className="space-y-5">
      <div className="flex gap-3">
        <SubTab active={sub === "basic"} onClick={() => setSub("basic")} icon={<Settings2 className="size-4" />} label="Basic" />
        <SubTab active={sub === "leaves"} onClick={() => setSub("leaves")} icon={<CalendarDays className="size-4" />} label="Leaves" />
      </div>
      {sub === "basic" ? <BasicSettings /> : <LeavePolicies />}
    </div>
  );
}

function SubTab({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-16 cursor-pointer flex-col items-center gap-1.5 rounded-lg border p-2.5 text-xs",
        active ? "border-primary text-foreground shadow-sm" : "border-border text-muted-foreground hover:bg-muted/40",
      )}
    >
      <span className="flex size-7 items-center justify-center rounded-md bg-muted">{icon}</span>
      {label}
    </button>
  );
}

function Row({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 border-b border-border px-5 py-4 last:border-b-0">
      <div>
        <div className="text-sm font-medium text-foreground">{title}</div>
        {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  );
}

function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn("relative h-5 w-9 cursor-pointer rounded-full transition-colors", checked ? "bg-primary" : "bg-zinc-300")}
    >
      <span className={cn("absolute top-0.5 size-4 rounded-full bg-white shadow transition-all", checked ? "left-4.5" : "left-0.5")} />
    </button>
  );
}

function SaveField({ value, placeholder, onSave }: { value: string; placeholder: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  return (
    <>
      <Input className="!w-56 shrink-0" placeholder={placeholder} value={v} onChange={(e) => setV(e.target.value.toUpperCase())} />
      <Button
        variant="primary"
        size="icon"
        aria-label="Save"
        onClick={() => {
          onSave(v);
          toast.success("Settings updated successfully");
        }}
      >
        <Check />
      </Button>
    </>
  );
}

function BasicSettings() {
  const s = useHrmsStore((st) => st.hrSettings);
  const update = useHrmsStore((st) => st.updateHrSettings);
  const [ip, setIp] = useState("");
  return (
    <div className="rounded-xl border border-border">
      <Row title="Employer PF Registration Number">
        <SaveField value={s.pfRegistrationNumber} placeholder="PF Number" onSave={(v) => update({ pfRegistrationNumber: v })} />
      </Row>
      <Row title="Employer ESI Registration Number">
        <SaveField value={s.esiRegistrationNumber} placeholder="ESI Number" onSave={(v) => update({ esiRegistrationNumber: v })} />
      </Row>
      <Row title="Payroll Cycle" sub="Day of the month the payroll period starts">
        <Select
          wrapperClassName="w-56"
          value={s.payrollCycleStartDay}
          onChange={(e) => {
            update({ payrollCycleStartDay: Number(e.target.value) });
            toast.success("Payroll cycle updated");
          }}
        >
          {Array.from({ length: 28 }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              {i + 1}
            </option>
          ))}
        </Select>
      </Row>
      <Row title="Authorised IP for Attendance Marking" sub="Employees are allowed to complete attendance marking through restricted IPs">
        <Switch checked={s.restrictAttendanceIp} onChange={(v) => update({ restrictAttendanceIp: v })} />
      </Row>
      {s.restrictAttendanceIp && (
        <div className="border-b border-border px-5 py-4">
          <div className="mb-2 text-sm font-medium">Allowed IPs</div>
          <div className="space-y-2">
            {s.allowedIps.map((x) => (
              <div key={x} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                {x}
                <button className="cursor-pointer text-xs text-destructive hover:underline" onClick={() => update({ allowedIps: s.allowedIps.filter((y) => y !== x) })}>
                  Remove
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <Input placeholder="Add IP address" value={ip} onChange={(e) => setIp(e.target.value)} />
              <Button
                disabled={!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)}
                onClick={() => {
                  update({ allowedIps: [...s.allowedIps, ip] });
                  setIp("");
                }}
              >
                Add
              </Button>
            </div>
          </div>
        </div>
      )}
      <Row title="Employee Attendance" sub="Check-in Location is required">
        <Switch checked={s.checkInLocationRequired} onChange={(v) => update({ checkInLocationRequired: v })} />
      </Row>
      <Row title="Employment Agreement" sub="Prepare and eSign employment contract with employees by using employment contract option">
        <Button onClick={() => toast.success("Opens the employment contract templates")}>Manage</Button>
      </Row>
    </div>
  );
}

function LeavePolicies() {
  const policies = useHrmsStore((s) => s.leavePolicies);
  const save = useHrmsStore((s) => s.saveLeavePolicy);
  const [show, setShow] = useState<"active" | "inactive">("active");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<LeavePolicy | "new" | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const rows = policies.filter((p) => (show === "active" ? p.active : !p.active) && p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="rounded-xl border border-border">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
        <div className="relative w-56">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search Policy" className="ps-9" />
        </div>
        <div className="flex items-center gap-2.5">
          <ToggleGroup
            value={show}
            onChange={setShow}
            items={[
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" },
            ]}
          />
          <Button onClick={() => setEditing("new")}>
            <SquarePlus /> Create New Policy
          </Button>
          <Button variant="ghost" onClick={() => toast.success("Policies refreshed")}>
            <RefreshCw /> Refresh
          </Button>
        </div>
      </div>
      <table className={tableCls}>
        <thead>
          <tr className="bg-muted/40">
            <th className={thCls}>Policy Name</th>
            <th className={thCls}>Status</th>
            <th className={`${thCls} w-20`}>Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} className={trCls}>
              <td className={tdCls}>
                <button className="cursor-pointer text-primary hover:underline" onClick={() => setEditing(p)}>
                  {p.name}
                </button>
              </td>
              <td className={tdCls}>
                <Badge variant={p.active ? "success" : "secondary"}>{p.active ? "Active" : "Inactive"}</Badge>
              </td>
              <td className={`${tdCls} relative`}>
                <button className="cursor-pointer rounded p-1 text-muted-foreground hover:bg-muted" onClick={() => setMenu(menu === p.id ? null : p.id)} aria-label="Actions">
                  <MoreHorizontal className="size-4" />
                </button>
                {menu === p.id && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setMenu(null)} />
                    <div className={`absolute right-4 z-20 mt-1 w-36 p-1 ${popoverCls}`}>
                      <button className={menuItemCls} onClick={() => (setMenu(null), setEditing(p))}>
                        Edit
                      </button>
                      <button className={menuItemCls} onClick={() => (setMenu(null), save({ ...p, active: !p.active }))}>
                        {p.active ? "Mark inactive" : "Mark active"}
                      </button>
                    </div>
                  </>
                )}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={3} className="px-4 py-8 text-center text-sm text-muted-foreground">
                No {show} policies.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {editing && <PolicySheet policy={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

const BLANK_ALLOC: LeaveAllocation = { applicable: false, frequency: "monthly", creditDate: "first_day_of_month", creditValue: 0, probationMonths: 0 };

function PolicySheet({ policy, onClose }: { policy: LeavePolicy | null; onClose: () => void }) {
  const save = useHrmsStore((s) => s.saveLeavePolicy);
  const [name, setName] = useState(policy?.name ?? "");
  const [duration, setDuration] = useState<LeavePolicy["duration"]>(policy?.duration ?? "CalendarYear");
  const [alloc, setAlloc] = useState<Record<string, LeaveAllocation>>(() =>
    Object.fromEntries(LEAVE_TYPES.map((t) => [t.key, policy?.allocation[t.key] ?? BLANK_ALLOC])),
  );
  const up = (k: string, patch: Partial<LeaveAllocation>) => setAlloc((a) => ({ ...a, [k]: { ...a[k], ...patch } }));

  return (
    <Sheet
      open
      onClose={onClose}
      title={policy ? "Edit Policy" : "Create New Policy"}
      className="lg:w-[560px]"
      header={<div className="text-base font-semibold">{policy ? "Edit Policy" : "Create New Policy"}</div>}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!name.trim()}
            onClick={() => {
              const allocation = Object.fromEntries(Object.entries(alloc).filter(([, a]) => a.applicable));
              save({ id: policy?.id ?? `lp-${Date.now()}`, name: name.trim(), active: policy?.active ?? true, applicableFrom: policy?.applicableFrom ?? TODAY, duration, allocation });
              toast.success(policy ? "Policy updated" : "Policy created");
              onClose();
            }}
          >
            {policy ? "Save Policy" : "Create Policy"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <Label>Leave Policy Name</Label>
          <Input className="!w-60 shrink-0" placeholder="Policy Name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="flex items-center justify-between gap-4">
          <Label>Leave Frequency</Label>
          <Select wrapperClassName="w-60" value={duration} onChange={(e) => setDuration(e.target.value as LeavePolicy["duration"])}>
            <option value="CalendarYear">Calendar Year</option>
            <option value="FinancialYear">Financial Year</option>
          </Select>
        </div>
        {LEAVE_TYPES.map((t) => {
          const a = alloc[t.key];
          return (
            <div key={t.key} className="rounded-lg border border-border p-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-medium">{t.name}</div>
                  <div className="text-xs text-muted-foreground">Is {t.name} Applicable ?</div>
                </div>
                <Select wrapperClassName="w-32" selectSize="sm" value={a.applicable ? "yes" : "no"} onChange={(e) => up(t.key, { applicable: e.target.value === "yes" })}>
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </Select>
              </div>
              {a.applicable && (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Credit frequency</Label>
                    <Select selectSize="sm" value={a.frequency} onChange={(e) => up(t.key, { frequency: e.target.value as LeaveAllocation["frequency"] })}>
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="annually">Annually</option>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Credit date</Label>
                    <Select selectSize="sm" value={a.creditDate} onChange={(e) => up(t.key, { creditDate: e.target.value as LeaveAllocation["creditDate"] })}>
                      <option value="first_day_of_month">First day of month</option>
                      <option value="beginning_of_year">Beginning of year</option>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Days credited</Label>
                    <Input inputSize="sm" type="number" value={a.creditValue} onChange={(e) => up(t.key, { creditValue: Number(e.target.value) || 0 })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Probation (months)</Label>
                    <Input inputSize="sm" type="number" value={a.probationMonths} onChange={(e) => up(t.key, { probationMonths: Number(e.target.value) || 0 })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Carry forward limit</Label>
                    <Input
                      inputSize="sm"
                      type="number"
                      placeholder="No carry forward"
                      value={a.carryForwardLimit ?? ""}
                      onChange={(e) => up(t.key, { carryForwardLimit: e.target.value ? Number(e.target.value) : undefined })}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Sheet>
  );
}

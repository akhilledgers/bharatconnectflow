import { useState, type ReactNode } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, MoreHorizontal, Pencil, UserX } from "lucide-react";
import { useHrmsStore } from "../../store/useHrmsStore";
import { Button } from "../../components/ui/button";
import { Dialog } from "../../components/ui/dialog";
import { FormItem, Input, Label, Select } from "../../components/ui/input";
import { menuItemCls, popoverCls } from "../../components/ui/popover";
import { Tabs } from "../../components/ui/tabs";
import { DEPARTMENTS, EMPLOYMENT_TYPES } from "./data";
import { TODAY, ageOn, fmtDate } from "./months";
import { REVISION_MONTH, isNewlyCovered, joinsEps, latestSalary, salaryFor } from "./payroll";
import { EPS_AGE_LIMIT, PF_REVISION } from "./statutory";
import { Avatar, StatusBadge } from "./shared";
import { SalarySetupTab } from "./SalarySetupTab";
import { PayslipTab } from "./PayslipTab";
import { ApplicationTab, AttendanceTab, DocumentsTab, NotesTab } from "./EmployeeTabs";
import type { Employee } from "./types";

// v4 /hrms/employee-dashboard?id=…: profile card on the left (Show More reveals branch, IDs, UAN, ESI,
// reporting, leave policy), tabs on the right — Attendance, Application, Salary Setup, Payslip,
// Documents, Notes.

type Tab = "attendance" | "application" | "salary" | "payslip" | "documents" | "notes";

export function EmployeeDashboardPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const employee = useHrmsStore((s) => s.employees.find((e) => e.id === id));
  const employees = useHrmsStore((s) => s.employees);
  const branches = useHrmsStore((s) => s.branches);
  const policies = useHrmsStore((s) => s.leavePolicies);
  const [more, setMore] = useState(false);
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [exiting, setExiting] = useState(false);
  const tab = (params.get("tab") as Tab) || "attendance";

  if (!employee)
    return (
      <div className="py-20 text-center text-sm text-muted-foreground">
        Employee not found.{" "}
        <button className="cursor-pointer text-primary hover:underline" onClick={() => navigate("/hrms/employees")}>
          Back to list
        </button>
      </div>
    );

  const branch = branches.find((b) => b.id === employee.branchId);
  const mgr = employees.find((e) => e.id === employee.reportingTo);
  const fmtAddr = (a?: Employee["presentAddress"]) => (a ? [a.line1, a.line2, a.city, a.state, a.pincode].filter(Boolean).join(", ") : "-");

  return (
    <div className="flex items-start gap-5">
      <aside className="w-72 shrink-0 rounded-xl border border-border bg-card shadow-xs shadow-black/5">
        <div className="flex items-start gap-3 border-b border-border p-5">
          <Avatar name={employee.name} size={48} />
          <div className="min-w-0 flex-1">
            <div className="text-base font-semibold leading-tight text-foreground">{employee.name}</div>
            <div className="mt-1.5">
              <StatusBadge status={employee.status} />
            </div>
          </div>
          <div className="relative">
            <Button variant="primary" size="icon-sm" onClick={() => setMenu(!menu)} aria-label="Employee actions">
              <MoreHorizontal />
            </Button>
            {menu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
                <div className={`absolute right-0 z-20 mt-1 w-44 space-y-0.5 p-1 ${popoverCls}`}>
                  <button
                    className={menuItemCls}
                    onClick={() => {
                      setMenu(false);
                      setEditing(true);
                    }}
                  >
                    <Pencil /> Edit profile
                  </button>
                  <button
                    className={`${menuItemCls} !text-destructive [&_svg]:!opacity-100`}
                    onClick={() => {
                      setMenu(false);
                      setExiting(true);
                    }}
                  >
                    <UserX /> Mark exit
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
        <dl className="space-y-3.5 p-5 text-sm">
          <Info label="Office Phone">{employee.officeMobile}</Info>
          <Info label="Office Email">{employee.officeEmail}</Info>
          <Info label="Permanent Address">{fmtAddr(employee.permanentAddress)}</Info>
          <Info label="Present Address">{fmtAddr(employee.presentAddress)}</Info>
          <Info label="Employment ID">{employee.employeeId}</Info>
          <Info label="Personal Email">{employee.personalEmail}</Info>
          <Info label="Personal Mobile">{employee.personalMobile}</Info>
          <Info label="Date of Birth">{fmtDate(employee.dob)}</Info>
          <Info label="Father's Name">{employee.fathersName}</Info>
          <Info label="Designation">{employee.designation}</Info>
          <Info label="Department">{employee.department}</Info>
          <Info label="Date of Joining">{fmtDate(employee.doj)}</Info>
          {employee.dateOfExit && <Info label="Date of Exit">{fmtDate(employee.dateOfExit)}</Info>}
          <Info label="Shift">
            {employee.shiftStart}:00 - {employee.shiftEnd}:00
          </Info>
          <Info label="Employment Type">{employee.employmentType}</Info>
          <Info label="PF / Pension">
            <PfStatus employee={employee} />
          </Info>
          {more && (
            <>
              <Info label="Branch">{branch?.name}</Info>
              <Info label="Religion">{employee.religion}</Info>
              <Info label="Blood Group">{employee.bloodGroup}</Info>
              <Info label="Gender">{employee.gender}</Info>
              <Info label="Marital Status">{employee.maritalStatus}</Info>
              <Info label="Bank">
                {employee.bank ? (
                  `${employee.bank.bankName} ••${employee.bank.accountNumber.slice(-4)}`
                ) : (
                  <button className="cursor-pointer text-primary hover:underline" onClick={() => setEditing(true)}>
                    Update
                  </button>
                )}
              </Info>
              <Info label="Aadhar">{employee.aadhaar}</Info>
              <Info label="PAN">{employee.pan}</Info>
              <Info label="UAN">{employee.uan}</Info>
              <Info label="ESI">{employee.esiNumber}</Info>
              <Info label="Reporting To">{mgr?.name}</Info>
              <Info label="Leave Policy">{policies.find((p) => p.id === employee.leavePolicyId)?.name}</Info>
            </>
          )}
        </dl>
        <button onClick={() => setMore(!more)} className="flex w-full cursor-pointer items-center gap-1.5 border-t border-border px-5 py-3 text-sm text-primary hover:bg-muted/40">
          {more ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          {more ? "Show Less" : "Show More"}
        </button>
      </aside>

      <section className="min-w-0 flex-1 rounded-xl border border-border bg-card shadow-xs shadow-black/5">
        <Tabs<Tab>
          variant="line"
          value={tab}
          onChange={(t) => setParams({ tab: t }, { replace: true })}
          items={[
            { value: "attendance", label: "Attendance" },
            { value: "application", label: "Application" },
            { value: "salary", label: "Salary Setup" },
            { value: "payslip", label: "Payslip" },
            { value: "documents", label: "Documents" },
            { value: "notes", label: "Notes" },
          ]}
        />
        <div className="p-5">
          {tab === "attendance" && <AttendanceTab employee={employee} />}
          {tab === "application" && <ApplicationTab employee={employee} />}
          {tab === "salary" && <SalarySetupTab key={employee.id} employee={employee} />}
          {tab === "payslip" && <PayslipTab employee={employee} />}
          {tab === "documents" && <DocumentsTab employee={employee} />}
          {tab === "notes" && <NotesTab employee={employee} />}
        </div>
      </section>

      {editing && <EditProfileDialog employee={employee} onClose={() => setEditing(false)} />}
      {exiting && <ExitDialog employee={employee} onClose={() => setExiting(false)} />}
    </div>
  );
}

/**
 * PF and pension (EPS) membership — needed for the ECR. Coverage from the PF ceiling revision shows its
 * date (recorded by the run, or "from 17 Sep" while still only computed).
 */
function PfStatus({ employee }: { employee: Employee }) {
  const salaries = useHrmsStore((s) => s.salaries);
  const rev = salaryFor(salaries, employee.id, REVISION_MONTH);
  const latest = latestSalary(salaries, employee.id);
  const newly = isNewlyCovered(employee, rev);
  const inPf = newly || (!!latest && latest.pfBasis !== "none");
  if (!inPf) return <span>Not a PF member</span>;
  const start = employee.doj > PF_REVISION.from ? employee.doj : PF_REVISION.from;
  const pf = newly ? `PF from ${fmtDate(employee.pfCoveredFrom ?? start)}` : "PF member";
  let eps: string;
  if (ageOn(employee.dob, TODAY) >= EPS_AGE_LIMIT) eps = "no EPS (58+)";
  else if (joinsEps(employee, rev)) eps = `EPS from ${fmtDate(employee.epsFrom ?? start)}`;
  else if (employee.epsMember === false) eps = "not in EPS";
  else eps = newly ? `EPS from ${fmtDate(employee.pfCoveredFrom ?? start)}` : "EPS member";
  return (
    <span>
      {pf} · {eps}
    </span>
  );
}

function Info({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words text-foreground">{children || "-"}</dd>
    </div>
  );
}

function EditProfileDialog({ employee, onClose }: { employee: Employee; onClose: () => void }) {
  const update = useHrmsStore((s) => s.updateEmployee);
  const branches = useHrmsStore((s) => s.branches);
  const policies = useHrmsStore((s) => s.leavePolicies);
  const [f, setF] = useState(employee);
  const set = <K extends keyof Employee>(k: K, v: Employee[K]) => setF((x) => ({ ...x, [k]: v }));
  const field = (label: string, node: ReactNode) => (
    <FormItem>
      <Label>{label}</Label>
      {node}
    </FormItem>
  );
  return (
    <Dialog
      open
      onClose={onClose}
      title="Edit profile"
      className="max-w-2xl"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => {
              update(employee.id, f);
              toast.success("Employee updated successfully");
              onClose();
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        {field("Designation", <Input value={f.designation ?? ""} onChange={(e) => set("designation", e.target.value)} />)}
        {field(
          "Department",
          <Select value={f.department ?? ""} onChange={(e) => set("department", e.target.value)}>
            <option value="">Select department</option>
            {DEPARTMENTS.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </Select>,
        )}
        {field(
          "Branch",
          <Select value={f.branchId ?? ""} onChange={(e) => set("branchId", e.target.value || undefined)}>
            <option value="">Select branch</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>,
        )}
        {field(
          "Employment Type",
          <Select value={f.employmentType} onChange={(e) => set("employmentType", e.target.value as Employee["employmentType"])}>
            {EMPLOYMENT_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>,
        )}
        {field("Date of Joining", <Input type="date" value={f.doj} onChange={(e) => set("doj", e.target.value)} />)}
        {field("Date of Birth", <Input type="date" value={f.dob} onChange={(e) => set("dob", e.target.value)} />)}
        {field("UAN", <Input value={f.uan ?? ""} onChange={(e) => set("uan", e.target.value.replace(/\D/g, "").slice(0, 12))} placeholder="12-digit UAN" />)}
        {field("ESI Number", <Input value={f.esiNumber ?? ""} onChange={(e) => set("esiNumber", e.target.value)} />)}
        {field("PAN", <Input value={f.pan ?? ""} onChange={(e) => set("pan", e.target.value.toUpperCase().slice(0, 10))} />)}
        {field("Aadhaar", <Input value={f.aadhaar ?? ""} onChange={(e) => set("aadhaar", e.target.value.replace(/\D/g, "").slice(0, 12))} />)}
        {field("Father's Name", <Input value={f.fathersName ?? ""} onChange={(e) => set("fathersName", e.target.value)} />)}
        {field(
          "Leave Policy",
          <Select value={f.leavePolicyId ?? ""} onChange={(e) => set("leavePolicyId", e.target.value || undefined)}>
            <option value="">None</option>
            {policies.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>,
        )}
      </div>
    </Dialog>
  );
}

function ExitDialog({ employee, onClose }: { employee: Employee; onClose: () => void }) {
  const update = useHrmsStore((s) => s.updateEmployee);
  const [date, setDate] = useState(employee.dateOfExit ?? "");
  return (
    <Dialog
      open
      onClose={onClose}
      title="Mark exit"
      description="The employee stays in payroll for the month they leave, paid up to this date."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="destructive"
            disabled={!date}
            onClick={() => {
              update(employee.id, { dateOfExit: date, status: "inactive" });
              toast.success("Exit recorded");
              onClose();
            }}
          >
            Mark exit
          </Button>
        </>
      }
    >
      <FormItem>
        <Label required>Date of Exit</Label>
        <Input type="date" value={date} min={employee.doj} onChange={(e) => setDate(e.target.value)} />
      </FormItem>
    </Dialog>
  );
}

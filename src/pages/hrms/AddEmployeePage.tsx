import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Briefcase, CheckCircle2, Landmark, MapPin, User } from "lucide-react";
import { useHrmsStore } from "../../store/useHrmsStore";
import { Button } from "../../components/ui/button";
import { Checkbox, FormItem, Input, Label, Select } from "../../components/ui/input";
import { cn } from "../../lib/cn";
import { DEPARTMENTS, EMPLOYMENT_TYPES, TITLES } from "./data";
import { fmtDate } from "./months";
import type { Address, Employee, EmploymentType } from "./types";

// v4 /hrms/add-employee: 5-step wizard — Personal Information, Employment Details, Address, Banking,
// Review & Finish. Nothing is saved until "Add Employee" on the last step.

const STEPS = [
  { title: "Personal Information", sub: "Basic contact and identity details", icon: User },
  { title: "Employment Details", sub: "Role, department and reporting structure", icon: Briefcase },
  { title: "Address", sub: "Current and permanent address", icon: MapPin },
  { title: "Banking", sub: "Banking information", icon: Landmark },
  { title: "Review & Finish", sub: "Final check before adding to system", icon: CheckCircle2 },
];

const emptyAddress: Address = { line1: "", line2: "", city: "", state: "", pincode: "" };

interface Form {
  title: string;
  name: string;
  status: Employee["status"];
  personalEmail: string;
  personalMobile: string;
  fathersName: string;
  dob: string;
  aadhaar: string;
  pan: string;
  gender: "" | Employee["gender"];
  employeeId: string;
  officeEmail: string;
  officeMobile: string;
  designation: string;
  department: string;
  reportingTo: string;
  employmentType: "" | EmploymentType;
  shiftStart: string;
  shiftEnd: string;
  branchId: string;
  doj: string;
  present: Address;
  permanent: Address;
  sameAsPresent: boolean;
  accountName: string;
  accountNumber: string;
  ifsc: string;
  bankName: string;
}

const INITIAL: Form = {
  title: "Mr.",
  name: "",
  status: "active",
  personalEmail: "",
  personalMobile: "",
  fathersName: "",
  dob: "",
  aadhaar: "",
  pan: "",
  gender: "",
  employeeId: "",
  officeEmail: "",
  officeMobile: "",
  designation: "",
  department: "",
  reportingTo: "",
  employmentType: "",
  shiftStart: "09:00",
  shiftEnd: "18:00",
  branchId: "",
  doj: "",
  present: emptyAddress,
  permanent: emptyAddress,
  sameAsPresent: true,
  accountName: "",
  accountNumber: "",
  ifsc: "",
  bankName: "",
};

function required(f: Form, step: number): string | null {
  if (step === 0) {
    if (!f.name.trim()) return "Employee Name is required";
    if (!/^\d{10}$/.test(f.personalMobile)) return "Enter a 10-digit personal mobile number";
    if (!f.dob) return "Date of Birth is required";
    if (!f.gender) return "Gender is required";
    if (f.pan && !/^[A-Z]{5}\d{4}[A-Z]$/.test(f.pan)) return "PAN format looks wrong";
  }
  if (step === 1) {
    if (!f.employeeId.trim()) return "Employee Id is required";
    if (!/^\S+@\S+\.\S+$/.test(f.officeEmail)) return "Enter a valid official email";
    if (!f.employmentType) return "Employment Type is required";
    if (!f.branchId) return "Branch is required";
    if (!f.doj) return "Date of Joining is required";
  }
  return null;
}

export function AddEmployeePage() {
  const navigate = useNavigate();
  const employees = useHrmsStore((s) => s.employees);
  const branches = useHrmsStore((s) => s.branches);
  const addEmployee = useHrmsStore((s) => s.addEmployee);
  const [step, setStep] = useState(0);
  const [f, setF] = useState<Form>(INITIAL);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));

  const next = () => {
    const err = required(f, step);
    setError(err);
    if (!err) setStep(step + 1);
  };

  const finish = () => {
    const e = addEmployee({
      employeeId: f.employeeId.trim(),
      title: f.title,
      name: f.name.trim(),
      status: f.status,
      personalEmail: f.personalEmail || undefined,
      personalMobile: f.personalMobile,
      officeEmail: f.officeEmail,
      officeMobile: f.officeMobile || undefined,
      fathersName: f.fathersName || undefined,
      dob: f.dob,
      gender: f.gender || "Male",
      aadhaar: f.aadhaar || undefined,
      pan: f.pan || undefined,
      designation: f.designation || undefined,
      department: f.department || undefined,
      reportingTo: f.reportingTo || undefined,
      employmentType: f.employmentType || "Full Time",
      shiftStart: f.shiftStart,
      shiftEnd: f.shiftEnd,
      branchId: f.branchId,
      doj: f.doj,
      presentAddress: f.present.line1 ? f.present : undefined,
      permanentAddress: f.sameAsPresent ? (f.present.line1 ? f.present : undefined) : f.permanent.line1 ? f.permanent : undefined,
      bank: f.accountNumber ? { accountName: f.accountName, accountNumber: f.accountNumber, ifsc: f.ifsc, bankName: f.bankName } : undefined,
    });
    toast.success("Employee added successfully");
    navigate(`/hrms/employees/${e.id}`);
  };

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-medium text-foreground">Add New Employee</h1>
        <p className="mt-1 text-sm text-muted-foreground">Initialize the digital workspace and legal profile for a new team member.</p>
      </div>

      <div className="flex items-start gap-5">
        <div className="w-72 shrink-0 space-y-2">
          {STEPS.map((s, i) => (
            <button
              key={s.title}
              disabled={i > step}
              onClick={() => setStep(i)}
              className={cn(
                "flex w-full items-start gap-3 rounded-xl p-3 text-left",
                i === step ? "bg-primary text-primary-foreground" : "bg-muted/60 text-foreground disabled:cursor-default enabled:cursor-pointer enabled:hover:bg-muted",
              )}
            >
              <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", i === step ? "bg-white/20" : "bg-background")}>
                <s.icon className="size-4" />
              </div>
              <div>
                <div className="text-sm font-medium">{s.title}</div>
                <div className={cn("text-xs", i === step ? "text-primary-foreground/80" : "text-muted-foreground")}>{s.sub}</div>
              </div>
            </button>
          ))}
        </div>

        <div className="min-w-0 flex-1 rounded-xl border border-border bg-card p-6 shadow-xs shadow-black/5">
          <div className="mb-5 text-right text-xs font-medium tracking-wide text-muted-foreground">
            STEP {step + 1} OF {STEPS.length}
          </div>

          {step === 0 && (
            <Grid>
              <Field label="Employee Name" required className="col-span-2">
                <div className="flex gap-2">
                  <Select wrapperClassName="w-24" value={f.title} onChange={(e) => set("title", e.target.value)}>
                    {TITLES.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </Select>
                  <Input placeholder="Enter Employee Name" value={f.name} onChange={(e) => set("name", e.target.value)} />
                </div>
              </Field>
              <Field label="Employee Status">
                <Select value={f.status} onChange={(e) => set("status", e.target.value as Employee["status"])}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </Select>
              </Field>
              <Field label="Personal Email">
                <Input type="email" placeholder="Enter personal email" value={f.personalEmail} onChange={(e) => set("personalEmail", e.target.value)} />
              </Field>
              <Field label="Personal Mobile Number" required>
                <div className="flex gap-2">
                  <Select wrapperClassName="w-20" defaultValue="+91">
                    <option>+91</option>
                  </Select>
                  <Input type="tel" placeholder="Enter personal mobile" value={f.personalMobile} onChange={(e) => set("personalMobile", e.target.value.replace(/\D/g, "").slice(0, 10))} />
                </div>
              </Field>
              <Field label="Father's Name">
                <Input placeholder="Enter father's name" value={f.fathersName} onChange={(e) => set("fathersName", e.target.value)} />
              </Field>
              <Field label="Date of Birth" required>
                <Input type="date" value={f.dob} onChange={(e) => set("dob", e.target.value)} />
              </Field>
              <Field label="Aadhaar">
                <Input placeholder="Enter Aadhaar number" value={f.aadhaar} onChange={(e) => set("aadhaar", e.target.value.replace(/\D/g, "").slice(0, 12))} />
              </Field>
              <Field label="PAN">
                <Input placeholder="Enter PAN number" value={f.pan} onChange={(e) => set("pan", e.target.value.toUpperCase().slice(0, 10))} />
              </Field>
              <Field label="Gender" required>
                <Select value={f.gender} onChange={(e) => set("gender", e.target.value as Form["gender"])}>
                  <option value="">Select Gender</option>
                  <option>Male</option>
                  <option>Female</option>
                  <option>Other</option>
                </Select>
              </Field>
            </Grid>
          )}

          {step === 1 && (
            <Grid>
              <Field label="Employee Id" required>
                <Input placeholder="Enter employee id" value={f.employeeId} onChange={(e) => set("employeeId", e.target.value)} />
              </Field>
              <Field label="Official Email" required>
                <Input type="email" placeholder="Enter official email" value={f.officeEmail} onChange={(e) => set("officeEmail", e.target.value)} />
              </Field>
              <Field label="Official Mobile number">
                <Input type="tel" placeholder="Enter official mobile" value={f.officeMobile} onChange={(e) => set("officeMobile", e.target.value.replace(/\D/g, "").slice(0, 10))} />
              </Field>
              <Field label="Designation">
                <Input placeholder="Enter designation" value={f.designation} onChange={(e) => set("designation", e.target.value)} />
              </Field>
              <Field label="Department">
                <Select value={f.department} onChange={(e) => set("department", e.target.value)}>
                  <option value="">Select department</option>
                  {DEPARTMENTS.map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Reporting To">
                <Select value={f.reportingTo} onChange={(e) => set("reportingTo", e.target.value)}>
                  <option value="">Select employee</option>
                  {employees
                    .filter((e) => e.status === "active")
                    .map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                </Select>
              </Field>
              <Field label="Employment Type" required>
                <Select value={f.employmentType} onChange={(e) => set("employmentType", e.target.value as EmploymentType)}>
                  <option value="">Select type</option>
                  {EMPLOYMENT_TYPES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Checkin-time" required>
                <Input type="time" value={f.shiftStart} onChange={(e) => set("shiftStart", e.target.value)} />
              </Field>
              <Field label="Checkout-time" required>
                <Input type="time" value={f.shiftEnd} onChange={(e) => set("shiftEnd", e.target.value)} />
              </Field>
              <Field label="Branch" required>
                <Select value={f.branchId} onChange={(e) => set("branchId", e.target.value)}>
                  <option value="">Select branch</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Date of Joining" required>
                <Input type="date" value={f.doj} onChange={(e) => set("doj", e.target.value)} />
              </Field>
            </Grid>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <AddressFields title="Present Address" value={f.present} onChange={(v) => set("present", v)} />
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={f.sameAsPresent} onChange={(e) => set("sameAsPresent", e.target.checked)} />
                Permanent address is the same as present address
              </label>
              {!f.sameAsPresent && <AddressFields title="Permanent Address" value={f.permanent} onChange={(v) => set("permanent", v)} />}
            </div>
          )}

          {step === 3 && (
            <Grid>
              <Field label="Account Holder Name">
                <Input placeholder="As per bank records" value={f.accountName} onChange={(e) => set("accountName", e.target.value)} />
              </Field>
              <Field label="Account Number">
                <Input placeholder="Enter account number" value={f.accountNumber} onChange={(e) => set("accountNumber", e.target.value.replace(/\D/g, ""))} />
              </Field>
              <Field label="IFSC">
                <Input placeholder="Enter IFSC" value={f.ifsc} onChange={(e) => set("ifsc", e.target.value.toUpperCase().slice(0, 11))} />
              </Field>
              <Field label="Bank Name">
                <Input placeholder="Enter bank name" value={f.bankName} onChange={(e) => set("bankName", e.target.value)} />
              </Field>
            </Grid>
          )}

          {step === 4 && (
            <div className="space-y-5">
              <Review
                title="Personal Information"
                rows={[
                  ["Name", `${f.title} ${f.name}`],
                  ["Status", f.status === "active" ? "Active" : "Inactive"],
                  ["Personal Mobile", `+91 ${f.personalMobile}`],
                  ["Personal Email", f.personalEmail || "-"],
                  ["Date of Birth", fmtDate(f.dob)],
                  ["Gender", f.gender || "-"],
                  ["PAN", f.pan || "-"],
                  ["Aadhaar", f.aadhaar || "-"],
                ]}
              />
              <Review
                title="Employment Details"
                rows={[
                  ["Employee Id", f.employeeId],
                  ["Official Email", f.officeEmail],
                  ["Designation", f.designation || "-"],
                  ["Department", f.department || "-"],
                  ["Employment Type", f.employmentType || "-"],
                  ["Shift", `${f.shiftStart} - ${f.shiftEnd}`],
                  ["Branch", branches.find((b) => b.id === f.branchId)?.name ?? "-"],
                  ["Date of Joining", fmtDate(f.doj)],
                ]}
              />
              <Review
                title="Banking"
                rows={[
                  ["Account Number", f.accountNumber || "-"],
                  ["IFSC", f.ifsc || "-"],
                  ["Bank", f.bankName || "-"],
                ]}
              />
              <p className="text-xs text-muted-foreground">Salary, PF and ESI are set up after adding the employee, on their Salary Setup tab.</p>
            </div>
          )}

          {error && <p className="mt-4 text-xs text-destructive">{error}</p>}

          <div className="mt-6 flex justify-between">
            {step > 0 ? (
              <Button variant="outline" onClick={() => setStep(step - 1)}>
                <ArrowLeft /> Back
              </Button>
            ) : (
              <Button variant="outline" onClick={() => navigate("/hrms/employees")}>
                Cancel
              </Button>
            )}
            {step < STEPS.length - 1 ? (
              <Button variant="primary" onClick={next}>
                Continue <ArrowRight />
              </Button>
            ) : (
              <Button variant="primary" onClick={finish}>
                Add Employee
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Grid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-x-5 gap-y-4">{children}</div>;
}

function Field({ label, required, className, children }: { label: string; required?: boolean; className?: string; children: ReactNode }) {
  return (
    <FormItem className={className}>
      <Label required={required}>{label}</Label>
      {children}
    </FormItem>
  );
}

function AddressFields({ title, value, onChange }: { title: string; value: Address; onChange: (v: Address) => void }) {
  const up = (k: keyof Address, v: string) => onChange({ ...value, [k]: v });
  return (
    <div>
      <div className="mb-3 text-sm font-medium text-foreground">{title}</div>
      <Grid>
        <Field label="Address Line 1" className="col-span-2">
          <Input value={value.line1} onChange={(e) => up("line1", e.target.value)} placeholder="Flat / building / street" />
        </Field>
        <Field label="Address Line 2" className="col-span-2">
          <Input value={value.line2} onChange={(e) => up("line2", e.target.value)} placeholder="Area / landmark" />
        </Field>
        <Field label="City">
          <Input value={value.city} onChange={(e) => up("city", e.target.value)} />
        </Field>
        <Field label="State">
          <Input value={value.state} onChange={(e) => up("state", e.target.value)} />
        </Field>
        <Field label="Pincode">
          <Input value={value.pincode} onChange={(e) => up("pincode", e.target.value.replace(/\D/g, "").slice(0, 6))} />
        </Field>
      </Grid>
    </div>
  );
}

function Review({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <div className="rounded-lg border border-border">
      <div className="border-b border-border bg-muted/40 px-4 py-2 text-sm font-medium">{title}</div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 p-4 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="text-right text-foreground">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

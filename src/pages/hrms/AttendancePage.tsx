import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { CalendarPlus } from "lucide-react";
import { useHrmsStore } from "../../store/useHrmsStore";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Dialog } from "../../components/ui/dialog";
import { FormItem, Input, Label } from "../../components/ui/input";
import { Tabs } from "../../components/ui/tabs";
import { tableCls, tdCls, thCls, trCls } from "../../components/ui/table";
import { cn } from "../../lib/cn";
import { MARK_STYLE, markFor } from "./attendance";
import { TODAY, fmtDate } from "./months";
import { EmptyRow, StatCard, panelCls } from "./shared";

// v4 /hrms/manage-attendance: Attendance Dashboard — Daily Attendance, Late Arrivals, Approved Leaves,
// Absent cards; Attendance / Approvals tabs for a chosen date; Add Holidays.

export function AttendancePage() {
  const navigate = useNavigate();
  const employees = useHrmsStore((s) => s.employees);
  const absences = useHrmsStore((s) => s.absences);
  const holidays = useHrmsStore((s) => s.holidays);
  const leaves = useHrmsStore((s) => s.leaveApplications);
  const setStatus = useHrmsStore((s) => s.setLeaveApplicationStatus);
  const [tab, setTab] = useState<"attendance" | "approvals">("attendance");
  const [date, setDate] = useState(TODAY);
  const [holidayOpen, setHolidayOpen] = useState(false);

  const rows = employees
    .filter((e) => e.status === "active")
    .map((e) => ({ e, mark: markFor(e, date, { absences, holidays, leaves }) }))
    .filter((r) => r.mark);
  const count = (m: string) => rows.filter((r) => r.mark === m).length;
  const pending = leaves.filter((l) => l.status === "pending");

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-medium text-foreground">Attendance Dashboard</h1>
        <Button onClick={() => setHolidayOpen(true)}>
          <CalendarPlus /> Add Holidays
        </Button>
      </div>
      <div className="mb-5 grid grid-cols-4 gap-4">
        <StatCard
          label="Daily Attendance"
          value={`${count("present") + count("late")}/${rows.length}`}
          hint={`Avg. ${rows.length ? Math.round(((count("present") + count("late")) / rows.length) * 100) : 0}% presence`}
        />
        <StatCard label="Late Arrivals" value={count("late")} hint="Arrived after shift start time" tone="text-amber-600" />
        <StatCard label="Approved Leaves" value={count("leave")} hint="Scheduled absences" tone="text-green-600" />
        <StatCard label="Absent" value={count("absent")} hint="Absent employees" tone="text-red-600" />
      </div>
      <div className={panelCls}>
        <div className="flex min-h-14 items-center justify-between border-b border-border px-5">
          <Tabs<"attendance" | "approvals">
            value={tab}
            onChange={setTab}
            items={[
              { value: "attendance", label: "Attendance" },
              { value: "approvals", label: `Approvals${pending.length ? ` (${pending.length})` : ""}` },
            ]}
          />
          {tab === "attendance" && <Input type="date" className="!w-44 shrink-0" value={date} max={TODAY} onChange={(e) => setDate(e.target.value || TODAY)} />}
        </div>
        {tab === "attendance" ? (
          <table className={tableCls}>
            <thead>
              <tr className="bg-muted/40">
                {["Employee", "Employee ID", "Shift", "Status"].map((h) => (
                  <th key={h} className={thCls}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ e, mark }) => (
                <tr key={e.id} className={trCls}>
                  <td className={tdCls}>
                    <button className="cursor-pointer text-primary hover:underline" onClick={() => navigate(`/hrms/employees/${e.id}`)}>
                      {e.name}
                    </button>
                  </td>
                  <td className={tdCls}>{e.employeeId}</td>
                  <td className={tdCls}>
                    {e.shiftStart} - {e.shiftEnd}
                  </td>
                  <td className={tdCls}>
                    <span className={cn("rounded px-2 py-0.5 text-xs font-medium", MARK_STYLE[mark!].cls)}>{MARK_STYLE[mark!].label}</span>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <EmptyRow colSpan={4}>No records found!</EmptyRow>}
            </tbody>
          </table>
        ) : (
          <table className={tableCls}>
            <thead>
              <tr className="bg-muted/40">
                {["Employee", "Type", "From", "To", "Days", "Reason", "Status", ""].map((h) => (
                  <th key={h} className={thCls}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {leaves.map((l) => (
                <tr key={l.id} className={trCls}>
                  <td className={tdCls}>{employees.find((e) => e.id === l.employeeId)?.name}</td>
                  <td className={tdCls}>{l.type}</td>
                  <td className={tdCls}>{fmtDate(l.from)}</td>
                  <td className={tdCls}>{fmtDate(l.to)}</td>
                  <td className={tdCls}>{l.days}</td>
                  <td className={tdCls}>{l.reason}</td>
                  <td className={tdCls}>
                    <Badge variant={l.status === "approved" ? "success" : l.status === "rejected" ? "destructive" : "warning"}>{l.status[0].toUpperCase() + l.status.slice(1)}</Badge>
                  </td>
                  <td className={`${tdCls} text-right`}>
                    {l.status === "pending" && (
                      <div className="flex justify-end gap-2">
                        <Button size="sm" onClick={() => setStatus(l.id, "rejected")}>
                          Reject
                        </Button>
                        <Button size="sm" variant="primary" onClick={() => setStatus(l.id, "approved")}>
                          Approve
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {holidayOpen && <HolidayDialog onClose={() => setHolidayOpen(false)} />}
    </div>
  );
}

function HolidayDialog({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  return (
    <Dialog
      open
      onClose={onClose}
      title="Add Holidays"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!name || !date}
            onClick={() => {
              useHrmsStore.setState((s) => ({ holidays: [...s.holidays, { date, name }] }));
              toast.success("Holiday added");
              onClose();
            }}
          >
            Add
          </Button>
        </>
      }
    >
      <FormItem>
        <Label>Holiday name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Diwali" />
      </FormItem>
      <FormItem>
        <Label>Date</Label>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </FormItem>
    </Dialog>
  );
}

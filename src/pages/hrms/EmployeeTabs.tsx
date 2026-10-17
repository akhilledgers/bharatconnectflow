import { useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, FileText, Upload } from "lucide-react";
import { useHrmsStore } from "../../store/useHrmsStore";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Textarea } from "../../components/ui/input";
import { tableCls, tdCls, thCls, trCls } from "../../components/ui/table";
import { cn } from "../../lib/cn";
import { MARK_STYLE, markFor, monthDates } from "./attendance";
import { CURRENT_MONTH, addMonths, fmtDate, parseMonth } from "./months";
import { EmptyRow } from "./shared";
import type { Employee } from "./types";

// The smaller employee-dashboard tabs: Attendance (month calendar), Application (leave requests),
// Documents, Notes.

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function AttendanceTab({ employee }: { employee: Employee }) {
  const absences = useHrmsStore((s) => s.absences);
  const holidays = useHrmsStore((s) => s.holidays);
  const leaves = useHrmsStore((s) => s.leaveApplications);
  const [month, setMonth] = useState(CURRENT_MONTH);
  const { year, monthIndex } = parseMonth(month);
  const dates = monthDates(month);
  const lead = new Date(year, monthIndex, 1).getDay();

  return (
    <div className="rounded-xl border border-border p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-semibold">
          {MONTH_NAMES[monthIndex]} {year}
        </div>
        <div className="flex gap-1">
          <Button size="icon-sm" onClick={() => setMonth(addMonths(month, -1))} aria-label="Previous month">
            <ChevronLeft />
          </Button>
          <Button size="icon-sm" onClick={() => setMonth(addMonths(month, 1))} aria-label="Next month">
            <ChevronRight />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-7 border-l border-t border-border text-xs">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="border-b border-r border-border bg-muted/40 px-2 py-1.5 font-medium text-muted-foreground">
            {d}
          </div>
        ))}
        {Array.from({ length: lead }, (_, i) => (
          <div key={`l${i}`} className="h-16 border-b border-r border-border" />
        ))}
        {dates.map((d) => {
          const mark = markFor(employee, d, { absences, holidays, leaves });
          return (
            <div key={d} className="h-16 border-b border-r border-border p-1.5">
              <div className="text-muted-foreground">{Number(d.slice(8))}</div>
              {mark && <div className={cn("mt-1 truncate rounded px-1 py-0.5 text-[10px] font-medium", MARK_STYLE[mark].cls)}>{MARK_STYLE[mark].label}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ApplicationTab({ employee }: { employee: Employee }) {
  const apps = useHrmsStore((s) => s.leaveApplications).filter((l) => l.employeeId === employee.id);
  const setStatus = useHrmsStore((s) => s.setLeaveApplicationStatus);
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className={tableCls}>
        <thead>
          <tr className="bg-muted/40">
            {["Type", "From", "To", "Days", "Reason", "Status", ""].map((h) => (
              <th key={h} className={thCls}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {apps.map((a) => (
            <tr key={a.id} className={trCls}>
              <td className={tdCls}>{a.type}</td>
              <td className={tdCls}>{fmtDate(a.from)}</td>
              <td className={tdCls}>{fmtDate(a.to)}</td>
              <td className={tdCls}>{a.days}</td>
              <td className={tdCls}>{a.reason}</td>
              <td className={tdCls}>
                <Badge variant={a.status === "approved" ? "success" : a.status === "rejected" ? "destructive" : "warning"}>{a.status[0].toUpperCase() + a.status.slice(1)}</Badge>
              </td>
              <td className={`${tdCls} text-right`}>
                {a.status === "pending" && (
                  <div className="flex justify-end gap-2">
                    <Button size="sm" onClick={() => setStatus(a.id, "rejected")}>
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => {
                        setStatus(a.id, "approved");
                        toast.success("Leave approved");
                      }}
                    >
                      Approve
                    </Button>
                  </div>
                )}
              </td>
            </tr>
          ))}
          {apps.length === 0 && <EmptyRow colSpan={7}>No applications.</EmptyRow>}
        </tbody>
      </table>
    </div>
  );
}

export function DocumentsTab({ employee }: { employee: Employee }) {
  const docs = useHrmsStore((s) => s.documents).filter((d) => d.employeeId === employee.id);
  const addDocument = useHrmsStore((s) => s.addDocument);
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <label className="inline-flex cursor-pointer">
          <span className="inline-flex h-8.5 items-center gap-1.5 rounded-md bg-primary px-3 text-2sm font-medium text-primary-foreground hover:bg-primary/90">
            <Upload className="size-4" /> Upload Document
          </span>
          <input
            type="file"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                addDocument(employee.id, f.name);
                toast.success("Document uploaded");
              }
              e.target.value = "";
            }}
          />
        </label>
      </div>
      {docs.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted-foreground">No documents uploaded.</div>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center gap-3 px-4 py-3 text-sm">
              <FileText className="size-4 opacity-60" />
              <span className="flex-1">{d.name}</span>
              <span className="text-xs text-muted-foreground">{fmtDate(d.uploadedOn)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function NotesTab({ employee }: { employee: Employee }) {
  const notes = useHrmsStore((s) => s.notes).filter((n) => n.employeeId === employee.id);
  const addNote = useHrmsStore((s) => s.addNote);
  const [text, setText] = useState("");
  return (
    <div className="space-y-3">
      <Textarea rows={3} placeholder="Add a note about this employee…" value={text} onChange={(e) => setText(e.target.value)} />
      <div className="flex justify-end">
        <Button
          variant="primary"
          disabled={!text.trim()}
          onClick={() => {
            addNote(employee.id, text.trim());
            setText("");
          }}
        >
          Add Note
        </Button>
      </div>
      {notes.map((n) => (
        <div key={n.id} className="rounded-lg border border-border p-3 text-sm">
          <div>{n.text}</div>
          <div className="mt-1 text-xs text-muted-foreground">{fmtDate(n.createdOn)}</div>
        </div>
      ))}
    </div>
  );
}

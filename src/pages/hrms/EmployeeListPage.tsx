import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowUpDown, CalendarDays, Funnel, Mail, Plus, Search, Settings2 } from "lucide-react";
import { useHrmsStore } from "../../store/useHrmsStore";
import { Input } from "../../components/ui/input";
import { menuItemCls, popoverCls } from "../../components/ui/popover";
import { tableCls, thCls, tdCls, trCls, TablePagination } from "../../components/ui/table";
import { fmtDate } from "./months";
import { EmptyRow, PageTitle, StatusBadge, panelCls, toolbarBtn } from "./shared";

// v4 /hrms/list-employee: "List Employee" card — search, joining-date filter, funnel (status), + (add),
// mail, column settings; columns Name, DOJ, Phone, Email, Reporting To, Branch, Status; 10 per page.

const PAGE = 10;
type StatusFilter = "active" | "inactive" | "all";
type SortKey = "name" | "doj";

export function EmployeeListPage() {
  const navigate = useNavigate();
  const employees = useHrmsStore((s) => s.employees);
  const branches = useHrmsStore((s) => s.branches);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("active");
  const [joinedAfter, setJoinedAfter] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean } | null>(null);
  const [page, setPage] = useState(0);
  const [filterOpen, setFilterOpen] = useState(false);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let r = employees.filter(
      (e) =>
        (status === "all" || e.status === status) &&
        (!joinedAfter || e.doj >= joinedAfter) &&
        (!q || e.name.toLowerCase().includes(q) || e.employeeId.toLowerCase().includes(q)),
    );
    if (sort) r = [...r].sort((a, b) => (sort.asc ? 1 : -1) * (sort.key === "name" ? a.name.localeCompare(b.name) : a.doj.localeCompare(b.doj)));
    return r;
  }, [employees, search, status, joinedAfter, sort]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const current = Math.min(page, pages - 1);
  const shown = rows.slice(current * PAGE, current * PAGE + PAGE);
  const sortBy = (key: SortKey) => setSort(sort?.key === key ? { key, asc: !sort.asc } : { key, asc: true });

  return (
    <div>
      <PageTitle>List Employee</PageTitle>
      <div className={panelCls}>
        <div className="flex min-h-14 flex-wrap items-center justify-between gap-2.5 border-b border-border px-5 py-3">
          <div className="relative w-56">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              placeholder="Search Employee.."
              className="ps-9"
            />
          </div>
          <div className="flex items-center gap-2.5">
            <label className={`${toolbarBtn} relative`} title="Joined on or after">
              <span className={joinedAfter ? "text-foreground" : "text-muted-foreground"}>{joinedAfter ? fmtDate(joinedAfter) : "Joining date"}</span>
              <CalendarDays />
              <input
                type="date"
                value={joinedAfter}
                onChange={(e) => {
                  setJoinedAfter(e.target.value);
                  setPage(0);
                }}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
            </label>
            <div className="relative">
              <button className={`${toolbarBtn} !px-2.5`} title="Filter" onClick={() => setFilterOpen(!filterOpen)}>
                <Funnel />
              </button>
              {filterOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setFilterOpen(false)} />
                  <div className={`absolute right-0 z-20 mt-1 w-40 space-y-0.5 p-1 ${popoverCls}`}>
                    {(["active", "inactive", "all"] as const).map((v) => (
                      <button
                        key={v}
                        className={`${menuItemCls} ${status === v ? "bg-accent" : ""}`}
                        onClick={() => {
                          setStatus(v);
                          setPage(0);
                          setFilterOpen(false);
                        }}
                      >
                        {v === "all" ? "All employees" : v === "active" ? "Active" : "Inactive"}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <button className={`${toolbarBtn} !px-2.5`} title="Add employee" onClick={() => navigate("/hrms/employees/new")}>
              <Plus />
            </button>
            <button className={`${toolbarBtn} !px-2.5`} title="Email employees" onClick={() => toast.success("Onboarding email sent to selected employees")}>
              <Mail />
            </button>
            <button className={`${toolbarBtn} !px-2.5`} title="Columns">
              <Settings2 />
            </button>
          </div>
        </div>

        <table className={`${tableCls} table-fixed`}>
          <thead>
            <tr className="bg-muted/40">
              <th className={thCls}>
                <button onClick={() => sortBy("name")} className="inline-flex cursor-pointer items-center gap-1.5">
                  Name <ArrowUpDown className="size-3.5 opacity-60" />
                </button>
              </th>
              <th className={`${thCls} w-32`}>
                <button onClick={() => sortBy("doj")} className="inline-flex cursor-pointer items-center gap-1.5">
                  DOJ <ArrowUpDown className="size-3.5 opacity-60" />
                </button>
              </th>
              <th className={`${thCls} w-36`}>Phone</th>
              <th className={thCls}>Email</th>
              <th className={thCls}>Reporting To</th>
              <th className={thCls}>Branch</th>
              <th className={`${thCls} w-28`}>Status</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((e) => {
              const mgr = employees.find((m) => m.id === e.reportingTo);
              return (
                <tr key={e.id} className={trCls}>
                  <td className={tdCls}>
                    <button onClick={() => navigate(`/hrms/employees/${e.id}`)} className="max-w-full cursor-pointer truncate text-sm text-primary hover:underline">
                      {e.name}
                    </button>
                  </td>
                  <td className={`${tdCls} text-sm text-gray-600`}>{fmtDate(e.doj)}</td>
                  <td className={`${tdCls} text-sm text-gray-600`}>{e.personalMobile || "-"}</td>
                  <td className={`${tdCls} truncate text-sm text-gray-600`}>{e.personalEmail || "-"}</td>
                  <td className={`${tdCls} truncate text-sm text-gray-600`}>{mgr?.name ?? "-"}</td>
                  <td className={`${tdCls} truncate text-sm text-gray-600`}>{branches.find((b) => b.id === e.branchId)?.name ?? "-"}</td>
                  <td className={tdCls}>
                    <StatusBadge status={e.status} />
                  </td>
                </tr>
              );
            })}
            {shown.length === 0 && <EmptyRow colSpan={7}>No employees found.</EmptyRow>}
          </tbody>
        </table>
        <div className="flex min-h-14 items-center px-5">
          <TablePagination from={current * PAGE + 1} to={current * PAGE + shown.length} total={rows.length} page={current} pages={pages} onPage={setPage} />
        </div>
      </div>
    </div>
  );
}

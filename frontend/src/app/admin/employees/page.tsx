"use client";

import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Briefcase,
  ChevronLeft,
  ChevronRight,
  IdCard,
  Mail,
  Phone,
  Search,
  User,
  Users,
} from "lucide-react";
import { z } from "zod";

import { AdminDetailDialog, AdminDetailInfoBlock } from "@/components/admin-detail-dialog";
import { EmployeeAttendanceHeatmap } from "@/components/employee-attendance-heatmap";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ACTION_BUTTON_CLASS, FIELD_CLASS } from "@/lib/admin-ui";
import {
  listEmployees,
  offboardEmployee,
  updateEmployee,
  updateEmployeeRole,
  type Employee,
  type EmployeeRole,
} from "@/lib/api-employees";
import { getMonthlyReport, type MonthlyReportRow } from "@/lib/api-reports";
import { ROLE_LABEL_TH, type Role } from "@/lib/mock-data";

const directoryRoles: EmployeeRole[] = ["employee", "supervisor", "admin"];
// student_gen is a generation ordinal (which admission cohort), not a
// calendar year — these are the only valid values, per the backend (see
// STUDENT_GENERATIONS in frontend/src/app/register/page.tsx).
const STUDENT_GENERATIONS = ["6", "7", "8", "9"] as const;
const PAGE_SIZE = 20;
// How long to wait after the last keystroke before sending a search request
// — the search box drives a real server-side query now (GET /employees's
// own search param), not a client-side filter over an already-loaded list.
const SEARCH_DEBOUNCE_MS = 300;
// Shared with the icon-prefixed inputs (ชื่อ, นามสกุล, Directory search) so
// their focus state reads as one design pass instead of the default gray ring.
const ICON_INPUT_CLASS = `${FIELD_CLASS} pl-9`;
// SelectTrigger's own base classes set height via `data-[size=default]:h-8`,
// a variant-guarded utility whose specificity beats a plain `h-9` override —
// same variant prefix needed here to actually win and match the inputs.
const SELECT_TRIGGER_CLASS = `${FIELD_CLASS} data-[size=default]:h-9`;

const employeeSchema = z.object({
  firstName: z.string().trim().min(1, "กรุณากรอกชื่อ"),
  lastName: z.string().trim().min(1, "กรุณากรอกนามสกุล"),
  role: z.enum(["employee", "supervisor", "admin"] as const),
  // Optional, matching the backend keeping them optional. The Select is
  // kept controlled from the first render (never undefined), so an unset
  // selection is "" rather than undefined — allowed here alongside the
  // real enum values.
  studentGen: z.union([z.enum(STUDENT_GENERATIONS), z.literal("")]).optional(),
  studentId: z.string().trim().optional(),
  phoneNumber: z.string().trim().optional(),
  project: z.string().trim().optional(),
  email: z.union([z.string().trim().email("อีเมลไม่ถูกต้อง"), z.literal("")]).optional(),
});

type EmployeeForm = z.infer<typeof employeeSchema>;

function statusBadge(employee: Employee) {
  if (employee.offboardedAt) {
    return <Badge variant="danger">พ้นสภาพแล้ว</Badge>;
  }
  if (employee.status === "active") {
    return <Badge variant="success">ใช้งานอยู่</Badge>;
  }
  return <Badge variant="secondary">ไม่ใช้งาน</Badge>;
}

// Never returns an empty string: falls back to the LINE display name, then
// the raw id — an employee can exist before completing registration (no
// first_name/last_name yet), and this must still show something.
function displayName(employee: Employee): string {
  const name = [employee.firstName, employee.lastName].filter(Boolean).join(" ");
  if (name) return name;
  if (employee.lineDisplayName) return employee.lineDisplayName;
  return employee.id;
}

function initials(employee: Employee): string {
  const parts = displayName(employee).split(" ").filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return displayName(employee).slice(0, 2).toUpperCase();
}

function EmployeeFormFields({
  defaultValues,
  onSubmit,
  onCancel,
  submitting,
}: {
  defaultValues: EmployeeForm;
  onSubmit: (values: EmployeeForm) => void;
  onCancel: () => void;
  submitting: boolean;
}) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<EmployeeForm>({
    resolver: zodResolver(employeeSchema),
    defaultValues,
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="firstName" className="font-semibold">
            ชื่อ
          </Label>
          <div className="relative">
            <User className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="firstName"
              placeholder="กรอกชื่อ"
              className={ICON_INPUT_CLASS}
              {...register("firstName")}
            />
          </div>
          {errors.firstName && (
            <p className="text-xs text-danger-foreground">{errors.firstName.message}</p>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="lastName" className="font-semibold">
            นามสกุล
          </Label>
          <div className="relative">
            <User className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="lastName"
              placeholder="กรอกนามสกุล"
              className={ICON_INPUT_CLASS}
              {...register("lastName")}
            />
          </div>
          {errors.lastName && (
            <p className="text-xs text-danger-foreground">{errors.lastName.message}</p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        {/* No htmlFor — SelectTrigger isn't a native input, and a native
            label->id click gets forwarded to it as a real click. */}
        <Label>ตำแหน่ง</Label>
        <Controller
          name="role"
          control={control}
          render={({ field }) => (
            // modal={false}: this Select's own modal layer defaults to on
            // (Base UI), which fights the parent Dialog's modal/outside-press
            // handling once nested inside it — any real click near the
            // trigger (the role label included) was being read as a click
            // outside the Dialog and closing the whole modal instead of
            // just the dropdown. Turning off the Select's own modal state
            // leaves the Dialog as the only outside-press authority.
            <Select value={field.value} onValueChange={field.onChange} modal={false}>
              <SelectTrigger id="role" className={`w-full ${SELECT_TRIGGER_CLASS}`}>
                <SelectValue placeholder="เลือกตำแหน่ง">
                  {(value: string | null) => (value ? ROLE_LABEL_TH[value as Role] : "เลือกตำแหน่ง")}
                </SelectValue>
              </SelectTrigger>
              {/* alignItemWithTrigger off: the default centers the selected
                  item over the trigger, which can push the list down far
                  enough to overlap the field below instead of anchoring
                  cleanly under the trigger. */}
              <SelectContent alignItemWithTrigger={false} sideOffset={4}>
                {directoryRoles.map((role) => (
                  <SelectItem key={role} value={role}>
                    {ROLE_LABEL_TH[role]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        {/* No htmlFor — SelectTrigger isn't a native input, same reason as
            the ตำแหน่ง Select above. */}
        <Label>รุ่นนักศึกษา</Label>
        <Controller
          name="studentGen"
          control={control}
          render={({ field }) => (
            <Select value={field.value ?? ""} onValueChange={field.onChange} modal={false}>
              <SelectTrigger id="studentGen" className={`w-full ${SELECT_TRIGGER_CLASS}`}>
                <SelectValue placeholder="เลือกรุ่นนักศึกษา">
                  {(value: string | null) => value || "เลือกรุ่นนักศึกษา"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false} sideOffset={4}>
                {STUDENT_GENERATIONS.map((gen) => (
                  <SelectItem key={gen} value={gen}>
                    {gen}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="studentId" className="font-semibold">
            รหัสนักศึกษา
          </Label>
          <div className="relative">
            <IdCard className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="studentId"
              placeholder="กรอกรหัสนักศึกษา"
              className={ICON_INPUT_CLASS}
              {...register("studentId")}
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="phoneNumber" className="font-semibold">
            เบอร์โทร
          </Label>
          <div className="relative">
            <Phone className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="phoneNumber"
              placeholder="กรอกเบอร์โทร"
              className={ICON_INPUT_CLASS}
              {...register("phoneNumber")}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email" className="font-semibold">
            อีเมล
          </Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              placeholder="กรอกอีเมล"
              className={ICON_INPUT_CLASS}
              {...register("email")}
            />
          </div>
          {errors.email && <p className="text-xs text-danger-foreground">{errors.email.message}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="project" className="font-semibold">
            โปรเจกต์ที่รับผิดชอบ
          </Label>
          <div className="relative">
            <Briefcase className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="project"
              placeholder="กรอกโปรเจกต์ที่รับผิดชอบ"
              className={ICON_INPUT_CLASS}
              {...register("project")}
            />
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" className={ACTION_BUTTON_CLASS} onClick={onCancel}>
          ยกเลิก
        </Button>
        <Button
          type="submit"
          disabled={submitting}
          className={`${ACTION_BUTTON_CLASS} bg-accent-600 text-white hover:bg-accent-700`}
        >
          {submitting ? "กำลังบันทึก..." : "บันทึก"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [total, setTotal] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Derived rather than a separate setState call at the top of the fetch
  // effect below (which would be a synchronous setState-in-effect) —
  // loading is simply "haven't finished loading the currently-requested
  // search/role/page combination yet".
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [offboardTarget, setOffboardTarget] = useState<Employee | null>(null);
  const [offboardSubmitting, setOffboardSubmitting] = useState(false);
  const [offboardError, setOffboardError] = useState<string | null>(null);

  const [detailEmployee, setDetailEmployee] = useState<Employee | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [monthStats, setMonthStats] = useState<MonthlyReportRow | null>(null);
  const [monthStatsError, setMonthStatsError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<EmployeeRole | "all">("all");
  const [page, setPage] = useState(1);
  const [pageResetKey, setPageResetKey] = useState("");

  // Debounce the search box before it drives a real request.
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Jump back to page 1 whenever the search/filter criteria change, so a
  // narrower result set never leaves the view stuck on a now out-of-range
  // page. Adjusted directly during render (React's documented pattern for
  // deriving state from a changed input) rather than in an effect.
  const resetKey = `${search}|${roleFilter}`;
  if (resetKey !== pageResetKey) {
    setPageResetKey(resetKey);
    setPage(1);
  }

  // Filtering and pagination happen server-side (GET /employees's own
  // search/role/limit/offset params) — this list is never re-filtered or
  // re-sliced client-side.
  const fetchKey = `${search}|${roleFilter}|${page}`;
  useEffect(() => {
    listEmployees({
      search: search || undefined,
      role: roleFilter === "all" ? undefined : roleFilter,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    })
      .then(({ employees: rows, total: count }) => {
        setEmployees(rows);
        setTotal(count);
        setLoadError(null);
      })
      .catch((err: Error) => setLoadError(err.message))
      .finally(() => setLoadedKey(fetchKey));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, roleFilter, page]);

  const loading = loadedKey !== fetchKey;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const openEditForm = (employee: Employee) => {
    setEditError(null);
    setEditingEmployee(employee);
    setFormOpen(true);
  };

  const openDetail = (employee: Employee) => {
    // Reset here (an event handler, not the fetch effect below) so
    // re-opening the dialog for a different employee never flashes the
    // previously-opened employee's stats while the new fetch is in flight.
    setMonthStats(null);
    setMonthStatsError(null);
    setDetailEmployee(employee);
    setDetailOpen(true);
  };

  // GET /reports/monthly is org-wide (same endpoint admin/reports.tsx
  // uses) -- no per-employee variant, so this fetches every row and picks
  // out the one for the opened employee. Matches the backend's own
  // worked-hours-with-schedule-cap logic exactly, rather than
  // reimplementing it client-side against GET /reports/daily-log.
  useEffect(() => {
    if (!detailEmployee) return;
    const month = new Date().toISOString().slice(0, 7);
    getMonthlyReport(month)
      .then((rows) => setMonthStats(rows.find((r) => r.employeeId === detailEmployee.id) ?? null))
      .catch((err: Error) => setMonthStatsError(err.message));
  }, [detailEmployee]);

  const handleSubmit = async (values: EmployeeForm) => {
    if (!editingEmployee) return;
    setEditError(null);
    setEditSubmitting(true);
    try {
      const profileUpdated = await updateEmployee(editingEmployee.id, {
        firstName: values.firstName,
        lastName: values.lastName,
        teamId: editingEmployee.teamId,
        studentGen: values.studentGen || null,
        studentId: values.studentId || null,
        phoneNumber: values.phoneNumber || null,
        project: values.project || null,
        email: values.email || null,
      });
      setEmployees((prev) => prev.map((e) => (e.id === profileUpdated.id ? profileUpdated : e)));

      // Only call the separate, more sensitive role-change endpoint if the
      // role actually changed. A system_owner target's role is never sent
      // for change even if the form displays "employee" for it (system_owner
      // isn't a selectable option) — comparing against the real underlying
      // role here, not the form's display fallback, avoids firing a
      // guaranteed-to-403 role-change on every edit of a system_owner row.
      if (editingEmployee.role !== "system_owner" && values.role !== editingEmployee.role) {
        const roleUpdated = await updateEmployeeRole(editingEmployee.id, values.role);
        setEmployees((prev) => prev.map((e) => (e.id === roleUpdated.id ? roleUpdated : e)));
      }

      setFormOpen(false);
    } catch (err) {
      // Dialog stays open so the admin can see the error and retry — any
      // profile-field update above already committed and is reflected in
      // the table even if a subsequent role-change 403'd.
      setEditError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setEditSubmitting(false);
    }
  };

  const confirmOffboard = async () => {
    if (!offboardTarget) return;
    setOffboardError(null);
    setOffboardSubmitting(true);
    try {
      const offboarded = await offboardEmployee(offboardTarget.id);
      setEmployees((prev) => prev.map((e) => (e.id === offboarded.id ? offboarded : e)));
      setOffboardTarget(null);
    } catch (err) {
      // Dialog stays open, error shown inline — covers both the 403
      // (insufficient rank, or target is system_owner) and 409 (already
      // offboarded by someone else between page load and this click) cases.
      setOffboardError(err instanceof Error ? err.message : "ดำเนินการไม่สำเร็จ");
    } finally {
      setOffboardSubmitting(false);
    }
  };

  const activeCount = employees.filter((e) => e.status === "active" && !e.offboardedAt).length;
  const offboardedCount = employees.filter((e) => e.offboardedAt !== null).length;

  const bannerStats = [
    { label: "พนักงานทั้งหมด", value: String(total) },
    { label: "ใช้งานอยู่ (หน้านี้)", value: String(activeCount) },
    { label: "พ้นสภาพแล้ว (หน้านี้)", value: String(offboardedCount) },
  ];

  return (
    <main className="flex flex-1 flex-col gap-6 px-6 pb-6">
      <header className="rounded-b-[20px] bg-brand-600 px-6 py-6 text-white">
        <h1 className="text-2xl font-bold">พนักงาน</h1>
        <p className="mt-1 text-sm text-white/80">จัดการรายชื่อและข้อมูลพนักงานของทีมคุณ</p>

        <div className="mt-4 flex items-center gap-6">
          {bannerStats.map((stat) => (
            <div key={stat.label}>
              <p className="text-xl font-bold tabular-nums">{stat.value}</p>
              <p className="text-xs text-white/80">{stat.label}</p>
            </div>
          ))}
        </div>
      </header>

      <Card className="rounded-2xl border border-slate-200 ring-0">
        <CardHeader>
          <CardTitle>รายชื่อพนักงาน</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-48 flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="ค้นหาจากชื่อ"
                className={`w-full ${ICON_INPUT_CLASS}`}
              />
            </div>
            <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as EmployeeRole | "all")}>
              <SelectTrigger className={`w-48 ${SELECT_TRIGGER_CLASS}`}>
                <SelectValue placeholder="ทั้งหมด">
                  {(value: string | null) =>
                    !value || value === "all" ? "ทั้งหมด" : ROLE_LABEL_TH[value as Role]
                  }
                </SelectValue>
              </SelectTrigger>
              {/* Same fix as the form's role select below: alignItemWithTrigger
                  off keeps this anchored under the trigger instead of
                  centering on whichever item is selected and drifting away
                  from it (up toward the card header when a later item is
                  selected). */}
              <SelectContent alignItemWithTrigger={false} sideOffset={4}>
                <SelectItem value="all">ทั้งหมด</SelectItem>
                {directoryRoles.map((role) => (
                  <SelectItem key={role} value={role}>
                    {ROLE_LABEL_TH[role]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading && <p className="text-sm text-muted-foreground">กำลังโหลด…</p>}
          {!loading && loadError && (
            <p className="text-sm text-danger-foreground">โหลดข้อมูลไม่สำเร็จ: {loadError}</p>
          )}

          {!loading && !loadError && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ชื่อ</TableHead>
                  <TableHead>ตำแหน่ง</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead>รุ่นนักศึกษา</TableHead>
                  <TableHead>รหัสนักศึกษา</TableHead>
                  <TableHead>เบอร์โทร</TableHead>
                  <TableHead>โปรเจกต์ที่รับผิดชอบ</TableHead>
                  <TableHead className="text-right">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((employee) => (
                  <TableRow
                    key={employee.id}
                    className="cursor-pointer"
                    onClick={() => openDetail(employee)}
                  >
                    <TableCell className="font-medium text-foreground">
                      <div className="flex items-center gap-3">
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-600">
                          {initials(employee)}
                        </div>
                        <span>{displayName(employee)}</span>
                      </div>
                    </TableCell>
                    <TableCell>{ROLE_LABEL_TH[employee.role]}</TableCell>
                    <TableCell>{statusBadge(employee)}</TableCell>
                    <TableCell>{employee.studentGen ? `(${employee.studentGen})` : "—"}</TableCell>
                    <TableCell>{employee.studentId ?? "—"}</TableCell>
                    <TableCell>{employee.phoneNumber ?? "—"}</TableCell>
                    <TableCell>{employee.project ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      {employee.offboardedAt ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="outline"
                            className={`${ACTION_BUTTON_CLASS} border-slate-200 text-muted-foreground`}
                            onClick={() => openEditForm(employee)}
                          >
                            แก้ไข
                          </Button>
                          <Button
                            variant="outline"
                            className={`${ACTION_BUTTON_CLASS} border-danger-foreground/30 text-danger-foreground hover:bg-danger hover:text-danger-foreground`}
                            onClick={() => {
                              setOffboardError(null);
                              setOffboardTarget(employee);
                            }}
                          >
                            พ้นสภาพ
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {employees.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                      ไม่พบพนักงานที่ตรงกับการค้นหา
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}

          {!loading && !loadError && total > 0 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                แสดง {(page - 1) * PAGE_SIZE + 1}
                {"–"}
                {Math.min(page * PAGE_SIZE, total)} จาก {total}
              </p>
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page === 1}
                    onClick={() => setPage(page - 1)}
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNumber) => (
                    <Button
                      key={pageNumber}
                      size="sm"
                      variant={pageNumber === page ? "default" : "outline"}
                      className={
                        pageNumber === page ? "bg-accent-600 text-white hover:bg-accent-700" : undefined
                      }
                      onClick={() => setPage(pageNumber)}
                    >
                      {pageNumber}
                    </Button>
                  ))}
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page === totalPages}
                    onClick={() => setPage(page + 1)}
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create is intentionally not offered here — there is no
          POST /employees endpoint by design. Employees are created only via
          LINE self-registration (see backend auth.go); this dialog is
          edit-only. */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>แก้ไขข้อมูลพนักงาน</DialogTitle>
          </DialogHeader>
          {editError && (
            <p className="rounded-md border border-danger bg-danger px-3 py-2 text-sm text-danger-foreground">
              {editError}
            </p>
          )}
          {formOpen && editingEmployee && (
            <EmployeeFormFields
              defaultValues={{
                firstName: editingEmployee.firstName ?? "",
                lastName: editingEmployee.lastName ?? "",
                role: editingEmployee.role === "system_owner" ? "employee" : editingEmployee.role,
                studentGen: STUDENT_GENERATIONS.includes(
                  editingEmployee.studentGen as (typeof STUDENT_GENERATIONS)[number]
                )
                  ? (editingEmployee.studentGen as (typeof STUDENT_GENERATIONS)[number])
                  : "",
                studentId: editingEmployee.studentId ?? "",
                phoneNumber: editingEmployee.phoneNumber ?? "",
                project: editingEmployee.project ?? "",
                email: editingEmployee.email ?? "",
              }}
              onSubmit={handleSubmit}
              onCancel={() => setFormOpen(false)}
              submitting={editSubmitting}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!offboardTarget}
        onOpenChange={(open) => {
          if (!open) {
            setOffboardTarget(null);
            setOffboardError(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ให้ {offboardTarget ? displayName(offboardTarget) : ""} พ้นสภาพ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              การดำเนินการนี้เป็นการลบแบบไม่ถาวร ข้อมูลและประวัติการเข้างานของพนักงานจะยังคงอยู่
              เพียงแค่ถูกทำเครื่องหมายว่าพ้นสภาพและไม่สามารถเช็คอินได้อีก
            </AlertDialogDescription>
          </AlertDialogHeader>
          {offboardError && (
            <p className="rounded-md border border-danger bg-danger px-3 py-2 text-sm text-danger-foreground">
              {offboardError}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel className={ACTION_BUTTON_CLASS}>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              className={ACTION_BUTTON_CLASS}
              disabled={offboardSubmitting}
              onClick={() => void confirmOffboard()}
            >
              {offboardSubmitting ? "กำลังดำเนินการ..." : "พ้นสภาพ"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AdminDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        icon={Users}
        title={detailEmployee ? displayName(detailEmployee) : ""}
        badgeText={detailEmployee ? ROLE_LABEL_TH[detailEmployee.role] : ""}
        badgeVariant="default"
        footer={
          <Button variant="outline" className={`${ACTION_BUTTON_CLASS} w-full`} onClick={() => setDetailOpen(false)}>
            ปิด
          </Button>
        }
      >
        {detailEmployee && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3.5">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-600">
                {initials(detailEmployee)}
              </div>
              <div className="flex flex-col gap-0.5 text-sm">
                <span className="font-medium text-foreground">{displayName(detailEmployee)}</span>
                <span className="text-xs text-muted-foreground">
                  {detailEmployee.registrationCompletedAt
                    ? "ลงทะเบียนเสร็จสิ้นแล้ว"
                    : "ยังไม่ได้ลงทะเบียน"}
                </span>
                <div className="mt-1 flex items-center gap-1.5 text-foreground">
                  <IdCard className="size-3.5 text-muted-foreground" />
                  {detailEmployee.studentId ?? "ไม่มีข้อมูลรหัสนักศึกษา"}
                </div>
                <div className="flex items-center gap-1.5 text-foreground">
                  <Phone className="size-3.5 text-muted-foreground" />
                  {detailEmployee.phoneNumber ?? "ไม่มีข้อมูลเบอร์โทรศัพท์"}
                </div>
                <div className="flex items-center gap-1.5 text-foreground">
                  <Mail className="size-3.5 text-muted-foreground" />
                  {detailEmployee.email ?? "ไม่มีข้อมูลอีเมล"}
                </div>
                <div className="flex items-center gap-1.5 text-foreground">
                  <Briefcase className="size-3.5 text-muted-foreground" />
                  {detailEmployee.project ?? "ไม่มีข้อมูลโปรเจกต์ที่รับผิดชอบ"}
                </div>
              </div>
            </div>

            {monthStatsError && (
              <p className="text-xs text-danger-foreground">โหลดสถิติไม่สำเร็จ: {monthStatsError}</p>
            )}
            {monthStats && (
              <div className="grid grid-cols-3 gap-2">
                <AdminDetailInfoBlock label="ชั่วโมง (เดือนนี้)" value={String(monthStats.workedHours)} valueSize="sm" />
                <AdminDetailInfoBlock label="สาย" value={String(monthStats.lateCount)} valueSize="sm" />
                <AdminDetailInfoBlock label="ขาด" value={String(monthStats.absentCount)} valueSize="sm" />
              </div>
            )}

            <div className="flex flex-col gap-2 rounded-xl border border-border p-3">
              <p className="text-xs font-semibold text-muted-foreground">
                ปฏิทินการเข้างาน (เดือนนี้)
              </p>
              <EmployeeAttendanceHeatmap employeeId={detailEmployee.id} />
            </div>
          </div>
        )}
      </AdminDetailDialog>
    </main>
  );
}

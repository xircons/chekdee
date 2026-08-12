"use client";

import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronLeft, ChevronRight, IdCard, Phone, Search, User, Users } from "lucide-react";
import { z } from "zod";

import { AdminDetailDialog, AdminDetailInfoBlock } from "@/components/admin-detail-dialog";
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
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  getMonthlyAttendanceStats,
  mockEmployees,
  ROLE_LABEL_TH,
  type MockEmployee,
  type Role,
} from "@/lib/mock-data";
import { useMe } from "@/lib/session";

const directoryRoles: Role[] = ["employee", "supervisor", "admin"];
const PAGE_SIZE = 20;
// Shared with the icon-prefixed inputs (ชื่อ, นามสกุล, Directory search) so
// their focus state reads as one design pass instead of the default gray ring.
const ICON_INPUT_CLASS = "pl-8 focus-visible:border-brand-600 focus-visible:ring-brand-600/30";

const employeeSchema = z.object({
  firstName: z.string().trim().min(1, "กรุณากรอกชื่อ"),
  lastName: z.string().trim().min(1, "กรุณากรอกนามสกุล"),
  role: z.enum(["employee", "supervisor", "admin"] as const),
  studentGen: z.string().trim().optional(),
});

type EmployeeForm = z.infer<typeof employeeSchema>;

function statusBadge(employee: MockEmployee) {
  if (employee.offboardedAt) {
    return <Badge variant="danger">พ้นสภาพแล้ว</Badge>;
  }
  if (employee.status === "active") {
    return <Badge variant="success">ใช้งานอยู่</Badge>;
  }
  return <Badge variant="secondary">ไม่ใช้งาน</Badge>;
}

function initials(employee: MockEmployee): string {
  return `${employee.firstName[0] ?? ""}${employee.lastName[0] ?? ""}`.toUpperCase();
}

function EmployeeFormFields({
  defaultValues,
  onSubmit,
  onCancel,
}: {
  defaultValues: EmployeeForm;
  onSubmit: (values: EmployeeForm) => void;
  onCancel: () => void;
}) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
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
        <Label htmlFor="role">ตำแหน่ง</Label>
        <Controller
          name="role"
          control={control}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="role" className="w-full">
                <SelectValue placeholder="เลือกตำแหน่ง" />
              </SelectTrigger>
              <SelectContent>
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
        <Label htmlFor="studentGen">รุ่นนักศึกษา (ถ้ามี)</Label>
        <Input id="studentGen" placeholder="เช่น 7" {...register("studentGen")} />
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          ยกเลิก
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting}
          className="bg-accent-600 text-white hover:bg-accent-700"
        >
          {isSubmitting ? "กำลังบันทึก..." : "บันทึก"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export default function EmployeesPage() {
  const me = useMe();
  const [employees, setEmployees] = useState<MockEmployee[]>(mockEmployees);
  const [formOpen, setFormOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<MockEmployee | null>(null);
  const [offboardTarget, setOffboardTarget] = useState<MockEmployee | null>(null);
  const [detailEmployee, setDetailEmployee] = useState<MockEmployee | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "all">("all");
  const [page, setPage] = useState(1);
  const [pageResetKey, setPageResetKey] = useState("");

  const filteredEmployees = useMemo(() => {
    const query = search.trim().toLowerCase();
    return employees.filter((e) => {
      const matchesQuery =
        query.length === 0 || `${e.firstName} ${e.lastName}`.toLowerCase().includes(query);
      const matchesRole = roleFilter === "all" || e.role === roleFilter;
      return matchesQuery && matchesRole;
    });
  }, [employees, search, roleFilter]);

  // Jump back to page 1 whenever the search/filter criteria change, so a
  // narrower result set never leaves the view stuck on a now-empty page.
  // Adjusted directly during render (React's documented pattern for
  // deriving state from a changed input) rather than in an effect.
  const resetKey = `${search}|${roleFilter}`;
  if (resetKey !== pageResetKey) {
    setPageResetKey(resetKey);
    setPage(1);
  }

  const totalPages = Math.max(1, Math.ceil(filteredEmployees.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedEmployees = filteredEmployees.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const totalCount = employees.length;
  const activeCount = employees.filter((e) => e.status === "active" && !e.offboardedAt).length;
  const offboardedCount = employees.filter((e) => e.offboardedAt !== null).length;

  const openCreateForm = () => {
    setEditingEmployee(null);
    setFormOpen(true);
  };

  const openEditForm = (employee: MockEmployee) => {
    setEditingEmployee(employee);
    setFormOpen(true);
  };

  const openDetail = (employee: MockEmployee) => {
    setDetailEmployee(employee);
    setDetailOpen(true);
  };

  const handleSubmit = (values: EmployeeForm) => {
    if (editingEmployee) {
      setEmployees((prev) =>
        prev.map((e) =>
          e.id === editingEmployee.id
            ? {
                ...e,
                firstName: values.firstName,
                lastName: values.lastName,
                role: values.role,
                studentGen: values.studentGen || null,
                displayName: `${values.firstName} ${values.lastName[0]}.`,
              }
            : e
        )
      );
    } else {
      const newEmployee: MockEmployee = {
        id: crypto.randomUUID(),
        role: values.role,
        status: "active",
        teamId: mockEmployees[0]?.teamId ?? "team-1",
        firstName: values.firstName,
        lastName: values.lastName,
        studentGen: values.studentGen || null,
        displayName: `${values.firstName} ${values.lastName[0]}.`,
        pictureUrl: null,
        offboardedAt: null,
        offboardedBy: null,
        offboardedReason: null,
      };
      setEmployees((prev) => [newEmployee, ...prev]);
    }
    setFormOpen(false);
  };

  const confirmOffboard = () => {
    if (!offboardTarget) return;
    setEmployees((prev) =>
      prev.map((e) =>
        e.id === offboardTarget.id
          ? { ...e, offboardedAt: new Date().toISOString(), offboardedBy: me.id, offboardedReason: null }
          : e
      )
    );
    setOffboardTarget(null);
  };

  const monthStats = detailEmployee
    ? getMonthlyAttendanceStats(detailEmployee.id, new Date().toISOString().slice(0, 7))
    : null;

  const bannerStats = [
    { label: "พนักงานทั้งหมด", value: String(totalCount) },
    { label: "ใช้งานอยู่", value: String(activeCount) },
    { label: "พ้นสภาพแล้ว", value: String(offboardedCount) },
  ];

  return (
    <main className="flex flex-1 flex-col gap-6 p-6">
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

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>ทำเนียบพนักงาน</CardTitle>
          <CardAction>
            <Button size="sm" className="bg-accent-600 text-white hover:bg-accent-700" onClick={openCreateForm}>
              เพิ่มพนักงาน
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-64">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ค้นหาจากชื่อ"
                className={ICON_INPUT_CLASS}
              />
            </div>
            <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as Role | "all")}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="ทั้งหมด" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทั้งหมด</SelectItem>
                {directoryRoles.map((role) => (
                  <SelectItem key={role} value={role}>
                    {ROLE_LABEL_TH[role]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ชื่อ</TableHead>
                <TableHead>ตำแหน่ง</TableHead>
                <TableHead>สถานะ</TableHead>
                <TableHead>รุ่นนักศึกษา</TableHead>
                <TableHead className="text-right">จัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedEmployees.map((employee) => (
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
                      <span>
                        {employee.firstName} {employee.lastName}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>{ROLE_LABEL_TH[employee.role]}</TableCell>
                  <TableCell>{statusBadge(employee)}</TableCell>
                  <TableCell>{employee.studentGen ? `(${employee.studentGen})` : "—"}</TableCell>
                  <TableCell className="text-right">
                    {employee.offboardedAt ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-slate-200 text-muted-foreground"
                          onClick={() => openEditForm(employee)}
                        >
                          แก้ไข
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-danger-foreground/30 text-danger-foreground hover:bg-danger hover:text-danger-foreground"
                          onClick={() => setOffboardTarget(employee)}
                        >
                          พ้นสภาพ
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {pagedEmployees.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    ไม่พบพนักงานที่ตรงกับการค้นหา
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {filteredEmployees.length > 0 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                แสดง {(currentPage - 1) * PAGE_SIZE + 1}
                {"–"}
                {Math.min(currentPage * PAGE_SIZE, filteredEmployees.length)} จาก{" "}
                {filteredEmployees.length}
              </p>
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={currentPage === 1}
                    onClick={() => setPage(currentPage - 1)}
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNumber) => (
                    <Button
                      key={pageNumber}
                      size="sm"
                      variant={pageNumber === currentPage ? "default" : "outline"}
                      className={pageNumber === currentPage ? "bg-accent-600 text-white hover:bg-accent-700" : undefined}
                      onClick={() => setPage(pageNumber)}
                    >
                      {pageNumber}
                    </Button>
                  ))}
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={currentPage === totalPages}
                    onClick={() => setPage(currentPage + 1)}
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingEmployee ? "แก้ไขข้อมูลพนักงาน" : "เพิ่มพนักงาน"}</DialogTitle>
          </DialogHeader>
          {formOpen && (
            <EmployeeFormFields
              defaultValues={{
                firstName: editingEmployee?.firstName ?? "",
                lastName: editingEmployee?.lastName ?? "",
                role: editingEmployee?.role === "system_owner" ? "employee" : editingEmployee?.role ?? "employee",
                studentGen: editingEmployee?.studentGen ?? "",
              }}
              onSubmit={handleSubmit}
              onCancel={() => setFormOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!offboardTarget} onOpenChange={(open) => !open && setOffboardTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ให้ {offboardTarget?.firstName} พ้นสภาพ?</AlertDialogTitle>
            <AlertDialogDescription>
              การดำเนินการนี้เป็นการลบแบบไม่ถาวร — ข้อมูลและประวัติการเข้างานของพนักงานจะยังคงอยู่
              เพียงแค่ถูกทำเครื่องหมายว่าพ้นสภาพและไม่สามารถเช็คอินได้อีก
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmOffboard}>
              พ้นสภาพ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AdminDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        icon={Users}
        title={detailEmployee ? `${detailEmployee.firstName} ${detailEmployee.lastName}` : ""}
        badgeText={detailEmployee ? ROLE_LABEL_TH[detailEmployee.role] : ""}
        badgeVariant="default"
        footer={
          <Button variant="outline" className="w-full" onClick={() => setDetailOpen(false)}>
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
                <div className="flex items-center gap-1.5 text-foreground">
                  <IdCard className="size-3.5 text-muted-foreground" />
                  {detailEmployee.studentId ?? "ไม่มีข้อมูลรหัสนักศึกษา"}
                </div>
                <div className="flex items-center gap-1.5 text-foreground">
                  <Phone className="size-3.5 text-muted-foreground" />
                  {detailEmployee.phoneNumber ?? "ไม่มีข้อมูลเบอร์โทรศัพท์"}
                </div>
              </div>
            </div>

            {monthStats && (
              <div className="grid grid-cols-3 gap-2">
                <AdminDetailInfoBlock label="ชั่วโมง (เดือนนี้)" value={String(monthStats.hours)} valueSize="sm" />
                <AdminDetailInfoBlock label="สาย" value={String(monthStats.lateCount)} valueSize="sm" />
                <AdminDetailInfoBlock label="ขาด" value={String(monthStats.absentCount)} valueSize="sm" />
              </div>
            )}
          </div>
        )}
      </AdminDetailDialog>
    </main>
  );
}

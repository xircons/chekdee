"use client";

import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { IdCard, Phone, Search, Users } from "lucide-react";
import { z } from "zod";

import { AdminDetailDialog, AdminDetailInfoBlock } from "@/components/admin-detail-dialog";
import { AdminPageHeader } from "@/components/admin-page-header";
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
import { getMonthlyAttendanceStats, mockEmployees, type MockEmployee, type Role } from "@/lib/mock-data";
import { useMe } from "@/lib/session";

const directoryRoles: Role[] = ["employee", "supervisor", "admin"];

const employeeSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  role: z.enum(["employee", "supervisor", "admin"] as const),
  studentGen: z.string().trim().optional(),
});

type EmployeeForm = z.infer<typeof employeeSchema>;

function statusBadge(employee: MockEmployee) {
  if (employee.offboardedAt) {
    return <Badge variant="danger">Offboarded</Badge>;
  }
  if (employee.status === "active") {
    return <Badge variant="success">Active</Badge>;
  }
  return <Badge variant="secondary">Inactive</Badge>;
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
          <Label htmlFor="firstName">First name</Label>
          <Input id="firstName" {...register("firstName")} />
          {errors.firstName && (
            <p className="text-xs text-danger-foreground">{errors.firstName.message}</p>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="lastName">Last name</Label>
          <Input id="lastName" {...register("lastName")} />
          {errors.lastName && (
            <p className="text-xs text-danger-foreground">{errors.lastName.message}</p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="role">Role</Label>
        <Controller
          name="role"
          control={control}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="role" className="w-full">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {directoryRoles.map((role) => (
                  <SelectItem key={role} value={role} className="capitalize">
                    {role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="studentGen">Student gen (optional)</Label>
        <Input id="studentGen" placeholder="e.g. 2026" {...register("studentGen")} />
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting}
          className="bg-accent-600 text-white hover:bg-accent-700"
        >
          {isSubmitting ? "Saving…" : "Save"}
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

  const filteredEmployees = useMemo(() => {
    const query = search.trim().toLowerCase();
    return employees.filter((e) => {
      const matchesQuery =
        query.length === 0 || `${e.firstName} ${e.lastName}`.toLowerCase().includes(query);
      const matchesRole = roleFilter === "all" || e.role === roleFilter;
      return matchesQuery && matchesRole;
    });
  }, [employees, search, roleFilter]);

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

  return (
    <main className="flex flex-1 flex-col gap-6 p-6">
      <AdminPageHeader title="Employees" subtitle="Manage your team's roster and profiles" />

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Directory</CardTitle>
          <CardAction>
            <Button size="sm" className="bg-accent-600 text-white hover:bg-accent-700" onClick={openCreateForm}>
              Add employee
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
                placeholder="Search by name"
                className="pl-8"
              />
            </div>
            <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as Role | "all")}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                {directoryRoles.map((role) => (
                  <SelectItem key={role} value={role} className="capitalize">
                    {role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Student gen</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEmployees.map((employee) => (
                <TableRow
                  key={employee.id}
                  className="cursor-pointer"
                  onClick={() => openDetail(employee)}
                >
                  <TableCell className="font-medium text-foreground">
                    {employee.firstName} {employee.lastName}
                  </TableCell>
                  <TableCell className="capitalize">{employee.role}</TableCell>
                  <TableCell>{statusBadge(employee)}</TableCell>
                  <TableCell>{employee.studentGen ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    {!employee.offboardedAt && (
                      <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        <Button size="sm" variant="outline" onClick={() => openEditForm(employee)}>
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => setOffboardTarget(employee)}
                        >
                          Offboard
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {filteredEmployees.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No employees match your search.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingEmployee ? "Edit employee" : "Add employee"}</DialogTitle>
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
            <AlertDialogTitle>Offboard {offboardTarget?.firstName}?</AlertDialogTitle>
            <AlertDialogDescription>
              This soft-deletes the employee — their record and attendance history stay
              intact, they&apos;re just marked offboarded and can no longer check in.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmOffboard}>
              Offboard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AdminDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        icon={Users}
        title={detailEmployee ? `${detailEmployee.firstName} ${detailEmployee.lastName}` : ""}
        badgeText={detailEmployee?.role ?? ""}
        badgeVariant="default"
        footer={
          <Button variant="outline" className="w-full" onClick={() => setDetailOpen(false)}>
            Close
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
                  {detailEmployee.studentId ?? "No student ID on file"}
                </div>
                <div className="flex items-center gap-1.5 text-foreground">
                  <Phone className="size-3.5 text-muted-foreground" />
                  {detailEmployee.phoneNumber ?? "No phone on file"}
                </div>
              </div>
            </div>

            {monthStats && (
              <div className="grid grid-cols-3 gap-2">
                <AdminDetailInfoBlock label="Hours (mo.)" value={String(monthStats.hours)} valueSize="sm" />
                <AdminDetailInfoBlock label="Late" value={String(monthStats.lateCount)} valueSize="sm" />
                <AdminDetailInfoBlock label="Absent" value={String(monthStats.absentCount)} valueSize="sm" />
              </div>
            )}
          </div>
        )}
      </AdminDetailDialog>
    </main>
  );
}

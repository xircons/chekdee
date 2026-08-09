"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

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
import { mockEmployees, type MockEmployee, type Role } from "@/lib/mock-data";
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
        <Button type="submit" disabled={isSubmitting}>
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

  const openCreateForm = () => {
    setEditingEmployee(null);
    setFormOpen(true);
  };

  const openEditForm = (employee: MockEmployee) => {
    setEditingEmployee(employee);
    setFormOpen(true);
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

  return (
    <main className="flex flex-1 flex-col gap-6 p-6">
      <h1 className="text-2xl font-bold text-foreground">Employees</h1>

      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle>Directory</CardTitle>
          <CardAction>
            <Button size="sm" onClick={openCreateForm}>
              Add employee
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
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
              {employees.map((employee) => (
                <TableRow key={employee.id}>
                  <TableCell className="font-medium text-foreground">
                    {employee.firstName} {employee.lastName}
                  </TableCell>
                  <TableCell className="capitalize">{employee.role}</TableCell>
                  <TableCell>{statusBadge(employee)}</TableCell>
                  <TableCell>{employee.studentGen ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    {!employee.offboardedAt && (
                      <div className="flex justify-end gap-2">
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
    </main>
  );
}

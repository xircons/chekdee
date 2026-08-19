"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FileBarChart2 } from "lucide-react";
import { z } from "zod";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  getActiveEmployees,
  getEmployeesOnLeave,
  getPendingLeaveRequests,
  getSimulatedRoster,
  mockLeaveRequests,
  mockWorkSchedules,
  type AttendanceStatus,
  type MockAttendanceCorrection,
  type MockEmployee,
  type MockLeaveRequest,
  type SimulatedRosterEntry,
} from "@/lib/mock-data";
import { useMe } from "@/lib/session";
import { cn, formatThaiDateWithDay } from "@/lib/utils";

const ACTION_BUTTON_CLASS = "h-9 rounded-lg px-5 text-sm focus-visible:ring-brand-600/20";
const FIELD_CLASS =
  "h-9 rounded-lg border-border bg-muted/40 px-4 text-sm focus-visible:border-brand-600 focus-visible:bg-card focus-visible:ring-brand-600/20";
const PREVIEW_LIMIT = 4;

const STATUS_LABEL_TH: Record<AttendanceStatus, string> = {
  present: "มาปกติ",
  สาย: "สาย",
  ขาด: "ขาด",
};

function toIsoDateLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function employeeName(employee: MockEmployee): string {
  return `${employee.firstName} ${employee.lastName}`;
}

function initials(employee: MockEmployee): string {
  return `${employee.firstName[0] ?? ""}${employee.lastName[0] ?? ""}`.toUpperCase();
}

const correctionSchema = z.object({
  status: z.enum(["present", "สาย", "ขาด"] as const),
  reason: z.string().trim().min(1, "กรุณาระบุเหตุผล"),
});

type CorrectionForm = z.infer<typeof correctionSchema>;

function CorrectionFormFields({
  currentStatus,
  onSubmit,
  onCancel,
}: {
  currentStatus: AttendanceStatus;
  onSubmit: (values: CorrectionForm) => void;
  onCancel: () => void;
}) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CorrectionForm>({
    resolver: zodResolver(correctionSchema),
    defaultValues: { status: currentStatus, reason: "" },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label>สถานะใหม่</Label>
        <Controller
          name="status"
          control={control}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange} modal={false}>
              <SelectTrigger className={`w-full ${FIELD_CLASS} data-[size=default]:h-9`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false} sideOffset={4}>
                {(["present", "สาย", "ขาด"] as const).map((status) => (
                  <SelectItem key={status} value={status}>
                    {STATUS_LABEL_TH[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="reason">เหตุผล</Label>
        <Textarea
          id="reason"
          placeholder="เช่น พนักงานแจ้งลาป่วยทางโทรศัพท์ ยังไม่ได้ยื่นคำขอลาในระบบ"
          className="rounded-lg border-border bg-muted/40 text-sm focus-visible:border-brand-600 focus-visible:bg-card focus-visible:ring-brand-600/20"
          {...register("reason")}
        />
        {errors.reason && <p className="text-xs text-danger-foreground">{errors.reason.message}</p>}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" className={ACTION_BUTTON_CLASS} onClick={onCancel}>
          ยกเลิก
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting}
          className={cn(ACTION_BUTTON_CLASS, "bg-accent-600 text-white hover:bg-accent-700")}
        >
          {isSubmitting ? "กำลังบันทึก..." : "บันทึก"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export default function AdminDashboard() {
  const me = useMe();
  const now = useMemo(() => new Date(), []);
  const todayIso = toIsoDateLocal(now);

  const [requests, setRequests] = useState<MockLeaveRequest[]>(mockLeaveRequests);
  const [corrections, setCorrections] = useState<MockAttendanceCorrection[]>([]);
  const [correctionTarget, setCorrectionTarget] = useState<SimulatedRosterEntry | null>(null);

  const employees = useMemo(() => getActiveEmployees(), []);
  const roster = useMemo(() => getSimulatedRoster(employees, mockWorkSchedules, now), [employees, now]);
  const onLeaveIds = useMemo(
    () => new Set(getEmployeesOnLeave(todayIso).map((r) => r.employeeId)),
    [todayIso]
  );

  const effectiveStatus = (employeeId: string, computed: AttendanceStatus | null): AttendanceStatus | null => {
    const override = corrections.find((c) => c.employeeId === employeeId && c.date === todayIso);
    return override ? override.newStatus : computed;
  };

  const absentToday = roster.filter(
    (r) => !onLeaveIds.has(r.employee.id) && effectiveStatus(r.employee.id, r.status) === "ขาด"
  );

  const pendingRequests = getPendingLeaveRequests().filter((r) =>
    requests.some((live) => live.id === r.id && live.status === "pending")
  );

  const decide = (id: string, status: "approved" | "rejected") => {
    setRequests((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, status, decidedBy: me.id, decidedAt: new Date().toISOString() } : r
      )
    );
  };

  const submitCorrection = (values: CorrectionForm) => {
    if (!correctionTarget) return;
    const previousStatus = effectiveStatus(correctionTarget.employee.id, correctionTarget.status);
    setCorrections((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        employeeId: correctionTarget.employee.id,
        date: todayIso,
        previousStatus,
        newStatus: values.status,
        reason: values.reason,
        correctedBy: me.id,
        correctedAt: new Date().toISOString(),
      },
    ]);
    setCorrectionTarget(null);
  };

  const quickStats = [
    { label: "เข้างานวันนี้", value: `${roster.filter((r) => r.checkInAt !== null).length}/${employees.length}` },
    { label: "คำขอลารออนุมัติ", value: String(pendingRequests.length) },
    { label: "ขาดวันนี้", value: String(absentToday.length) },
  ];

  return (
    <main className="flex flex-1 flex-col gap-6 px-6 pb-6">
      <header className="rounded-b-[20px] bg-brand-600 px-6 py-6 text-white">
        <h1 className="text-2xl font-bold">
          ยินดีต้อนรับ, {me.first_name ?? me.display_name}
        </h1>
        <p className="mt-1 text-sm text-white/80">{formatThaiDateWithDay(now)}</p>

        <div className="mt-4 flex items-center gap-6">
          {quickStats.map((stat) => (
            <div key={stat.label}>
              <p className="text-xl font-bold tabular-nums">{stat.value}</p>
              <p className="text-xs text-white/80">{stat.label}</p>
            </div>
          ))}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="rounded-2xl border border-slate-200 ring-0">
          <CardHeader>
            <CardTitle>คำขอลารออนุมัติ</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {pendingRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground">ไม่มีคำขอลารออนุมัติ</p>
            ) : (
              pendingRequests.slice(0, PREVIEW_LIMIT).map((request) => {
                const employee = employees.find((e) => e.id === request.employeeId);
                return (
                  <div
                    key={request.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {employee ? employeeName(employee) : request.employeeId}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {request.leaveType ?? "-"} · {request.startDate}
                        {request.endDate !== request.startDate ? ` - ${request.endDate}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button
                        size="sm"
                        className="cursor-pointer bg-success-foreground text-white hover:bg-success-foreground/90"
                        onClick={() => decide(request.id, "approved")}
                      >
                        อนุมัติ
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="cursor-pointer"
                        onClick={() => decide(request.id, "rejected")}
                      >
                        ปฏิเสธ
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
            {pendingRequests.length > PREVIEW_LIMIT && (
              <Link
                href="/admin/leave-requests"
                className="text-xs font-medium text-brand-600 hover:underline"
              >
                ดูทั้งหมด ({pendingRequests.length}) →
              </Link>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-slate-200 ring-0">
          <CardHeader>
            <CardTitle>ขาดวันนี้</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {absentToday.length === 0 ? (
              <p className="text-sm text-muted-foreground">วันนี้ยังไม่มีพนักงานขาดงาน</p>
            ) : (
              absentToday.slice(0, PREVIEW_LIMIT).map((entry) => (
                <div
                  key={entry.employee.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-danger text-xs font-semibold text-danger-foreground">
                      {initials(entry.employee)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {employeeName(entry.employee)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        นัดเข้างาน{" "}
                        {entry.scheduledStart.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    className={`${ACTION_BUTTON_CLASS} shrink-0 border-slate-200 text-muted-foreground`}
                    onClick={() => setCorrectionTarget(entry)}
                  >
                    แก้ไขสถานะ
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border border-slate-200 ring-0">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-600">
              <FileBarChart2 className="size-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">รายงานการเข้างาน</p>
              <p className="text-xs text-muted-foreground">สรุปและส่งออกข้อมูลการเข้างานรายเดือน</p>
            </div>
          </div>
          <Link
            href="/admin/reports"
            className={cn(buttonVariants({ variant: "outline" }), ACTION_BUTTON_CLASS, "border-slate-200")}
          >
            ไปที่รายงาน
          </Link>
        </CardContent>
      </Card>

      <Dialog open={!!correctionTarget} onOpenChange={(open) => !open && setCorrectionTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              แก้ไขสถานะของ {correctionTarget ? employeeName(correctionTarget.employee) : ""}
            </DialogTitle>
          </DialogHeader>
          {correctionTarget && (
            <CorrectionFormFields
              currentStatus={effectiveStatus(correctionTarget.employee.id, correctionTarget.status) ?? "ขาด"}
              onSubmit={submitCorrection}
              onCancel={() => setCorrectionTarget(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}

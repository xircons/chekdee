"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarRange } from "lucide-react";
import { z } from "zod";

import { EmployeeListRow } from "@/components/employee-list-row";
import { EmployeePageHeader } from "@/components/employee-page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getLeaveRequestsForEmployee, type LeaveStatus, type MockLeaveRequest } from "@/lib/mock-data";
import { useMe } from "@/lib/session";
import { cn } from "@/lib/utils";

const fieldClass =
  "h-12 rounded-xl border-border bg-muted/40 px-3 text-sm placeholder:text-sm focus-visible:border-brand-600 focus-visible:bg-card focus-visible:ring-brand-600/20";

const leaveRequestSchema = z
  .object({
    start_date: z.string().min(1, "กรุณาระบุวันที่เริ่มลา"),
    end_date: z.string().min(1, "กรุณาระบุวันที่สิ้นสุด"),
    reason: z.string().trim().min(1, "กรุณาระบุเหตุผล"),
  })
  .refine((data) => data.end_date >= data.start_date, {
    message: "วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่มลา",
    path: ["end_date"],
  });

type LeaveRequestForm = z.infer<typeof leaveRequestSchema>;

const statusBadgeVariant: Record<LeaveStatus, "warning" | "success" | "danger"> = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
};

const statusLabelTh: Record<LeaveStatus, string> = {
  pending: "รอดำเนินการ",
  approved: "อนุมัติแล้ว",
  rejected: "ไม่อนุมัติ",
};

function formatDateRange(startDate: string, endDate: string): string {
  const format = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString([], { month: "short", day: "numeric" });
  return startDate === endDate ? format(startDate) : `${format(startDate)} – ${format(endDate)}`;
}

export default function LeavePage() {
  const me = useMe();
  const [requests, setRequests] = useState<MockLeaveRequest[]>(() => getLeaveRequestsForEmployee(me.id));

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<LeaveRequestForm>({
    resolver: zodResolver(leaveRequestSchema),
  });

  const onSubmit = (values: LeaveRequestForm) => {
    const newRequest: MockLeaveRequest = {
      id: `leave-local-${crypto.randomUUID()}`,
      employeeId: me.id,
      startDate: values.start_date,
      endDate: values.end_date,
      reason: values.reason,
      status: "pending",
      decidedBy: null,
      decidedAt: null,
    };
    setRequests((prev) => [newRequest, ...prev]);
    reset();
  };

  return (
    <div className="flex w-full flex-1 flex-col">
      <EmployeePageHeader title="ขอลา" subtitle="จัดการคำขอลาของคุณ" />

      <div className="flex flex-col gap-6 px-6 py-6">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>ยื่นคำขอลา</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="start_date" className="text-xs text-muted-foreground">
                    วันที่เริ่มลา
                  </Label>
                  <Input id="start_date" type="date" className={fieldClass} {...register("start_date")} />
                  {errors.start_date && (
                    <p className="text-xs text-danger-foreground">{errors.start_date.message}</p>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="end_date" className="text-xs text-muted-foreground">
                    วันที่สิ้นสุด
                  </Label>
                  <Input id="end_date" type="date" className={fieldClass} {...register("end_date")} />
                  {errors.end_date && (
                    <p className="text-xs text-danger-foreground">{errors.end_date.message}</p>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="reason" className="text-xs text-muted-foreground">
                  เหตุผล
                </Label>
                <Textarea
                  id="reason"
                  placeholder="ระบุเหตุผลการลา"
                  className={cn(fieldClass, "min-h-32 py-3")}
                  {...register("reason")}
                />
                {errors.reason && (
                  <p className="text-xs text-danger-foreground">{errors.reason.message}</p>
                )}
              </div>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="mt-2 h-12 w-full rounded-2xl bg-accent-600 text-base font-semibold text-white hover:bg-accent-700"
              >
                {isSubmitting ? "กำลังส่ง…" : "ส่งคำขอ"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>คำขอของคุณ</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col">
            {requests.length === 0 && (
              <p className="text-sm text-muted-foreground">ยังไม่มีคำขอลา</p>
            )}
            {requests.map((request) => (
              <EmployeeListRow
                key={request.id}
                icon={CalendarRange}
                label={formatDateRange(request.startDate, request.endDate)}
                sublabel={request.reason ?? undefined}
                trailing={
                  <Badge variant={statusBadgeVariant[request.status]}>
                    {statusLabelTh[request.status]}
                  </Badge>
                }
              />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

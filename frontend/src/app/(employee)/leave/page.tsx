"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getLeaveRequestsForEmployee, type LeaveStatus, type MockLeaveRequest } from "@/lib/mock-data";
import { useMe } from "@/lib/session";

const leaveRequestSchema = z
  .object({
    start_date: z.string().min(1, "Start date is required"),
    end_date: z.string().min(1, "End date is required"),
    reason: z.string().trim().min(1, "Reason is required"),
  })
  .refine((data) => data.end_date >= data.start_date, {
    message: "End date must be on or after the start date",
    path: ["end_date"],
  });

type LeaveRequestForm = z.infer<typeof leaveRequestSchema>;

const statusBadgeVariant: Record<LeaveStatus, "warning" | "success" | "danger"> = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
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
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-6">
      <h1 className="text-2xl font-bold text-foreground">Leave</h1>

      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle>Request leave</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="start_date">Start date</Label>
                <Input id="start_date" type="date" {...register("start_date")} />
                {errors.start_date && (
                  <p className="text-xs text-danger-foreground">{errors.start_date.message}</p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="end_date">End date</Label>
                <Input id="end_date" type="date" {...register("end_date")} />
                {errors.end_date && (
                  <p className="text-xs text-danger-foreground">{errors.end_date.message}</p>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="reason">Reason</Label>
              <Textarea id="reason" placeholder="What's this leave for?" {...register("reason")} />
              {errors.reason && (
                <p className="text-xs text-danger-foreground">{errors.reason.message}</p>
              )}
            </div>

            <Button type="submit" disabled={isSubmitting} className="mt-2 w-full">
              {isSubmitting ? "Submitting…" : "Submit request"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle>Your requests</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {requests.length === 0 && (
            <p className="text-sm text-muted-foreground">No leave requests yet.</p>
          )}
          {requests.map((request) => (
            <div
              key={request.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-border p-3"
            >
              <div>
                <p className="text-sm font-medium text-foreground">
                  {formatDateRange(request.startDate, request.endDate)}
                </p>
                {request.reason && (
                  <p className="text-xs text-muted-foreground">{request.reason}</p>
                )}
              </div>
              <Badge variant={statusBadgeVariant[request.status]} className="capitalize">
                {request.status}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </main>
  );
}

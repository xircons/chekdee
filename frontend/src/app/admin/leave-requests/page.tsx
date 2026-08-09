"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { mockEmployees, mockLeaveRequests, type LeaveStatus, type MockLeaveRequest } from "@/lib/mock-data";
import { useMe } from "@/lib/session";

const statusBadgeVariant: Record<LeaveStatus, "warning" | "success" | "danger"> = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
};

function employeeName(employeeId: string): string {
  const employee = mockEmployees.find((e) => e.id === employeeId);
  return employee ? `${employee.firstName} ${employee.lastName}` : employeeId;
}

function formatDateRange(startDate: string, endDate: string): string {
  const format = (d: string) =>
    new Date(`${d}T00:00:00Z`).toLocaleDateString([], { month: "short", day: "numeric" });
  return startDate === endDate ? format(startDate) : `${format(startDate)} – ${format(endDate)}`;
}

export default function LeaveRequestsPage() {
  const me = useMe();
  const [requests, setRequests] = useState<MockLeaveRequest[]>(mockLeaveRequests);

  const decide = (id: string, status: "approved" | "rejected") => {
    setRequests((prev) =>
      prev.map((r) =>
        r.id === id
          ? { ...r, status, decidedBy: me.id, decidedAt: new Date().toISOString() }
          : r
      )
    );
  };

  const sortedRequests = [...requests].sort((a, b) => {
    if (a.status === "pending" && b.status !== "pending") return -1;
    if (a.status !== "pending" && b.status === "pending") return 1;
    return b.startDate.localeCompare(a.startDate);
  });

  return (
    <main className="flex flex-1 flex-col gap-6 p-6">
      <h1 className="text-2xl font-bold text-foreground">Leave requests</h1>

      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle>Approval list</CardTitle>
          <p className="text-sm text-muted-foreground">
            In-app fallback — approvals also come in through the email-approval link
            sent with each request.
          </p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRequests.map((request) => (
                <TableRow key={request.id}>
                  <TableCell className="font-medium text-foreground">
                    {employeeName(request.employeeId)}
                  </TableCell>
                  <TableCell>{formatDateRange(request.startDate, request.endDate)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {request.reason ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusBadgeVariant[request.status]} className="capitalize">
                      {request.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {request.status === "pending" && (
                      <div className="flex justify-end gap-2">
                        <Button size="sm" onClick={() => decide(request.id, "approved")}>
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => decide(request.id, "rejected")}
                        >
                          Reject
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
    </main>
  );
}

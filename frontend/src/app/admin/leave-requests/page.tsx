"use client";

import { useState } from "react";
import { CalendarRange, Check, X } from "lucide-react";

import { AdminDetailDialog, AdminDetailInfoBlock } from "@/components/admin-detail-dialog";
import { AdminPageHeader } from "@/components/admin-page-header";
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
import { buildLeaveRequestEmail } from "@/lib/leave-email";
import { mockEmployees, mockLeaveRequests, type LeaveStatus, type MockLeaveRequest } from "@/lib/mock-data";
import { useMe } from "@/lib/session";

const statusBadgeVariant: Record<LeaveStatus, "warning" | "success" | "danger"> = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
};

function findEmployee(employeeId: string) {
  return mockEmployees.find((e) => e.id === employeeId);
}

function employeeName(employeeId: string): string {
  const employee = findEmployee(employeeId);
  return employee ? `${employee.firstName} ${employee.lastName}` : employeeId;
}

function formatDateRange(startDate: string, endDate: string): string {
  const format = (d: string) =>
    new Date(`${d}T00:00:00Z`).toLocaleDateString([], { month: "short", day: "numeric" });
  return startDate === endDate ? format(startDate) : `${format(startDate)} - ${format(endDate)}`;
}

function formatSubmitted(iso: string): string {
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

export default function LeaveRequestsPage() {
  const me = useMe();
  const [requests, setRequests] = useState<MockLeaveRequest[]>(mockLeaveRequests);
  const [selectedRequest, setSelectedRequest] = useState<MockLeaveRequest | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const decide = (id: string, status: "approved" | "rejected") => {
    setRequests((prev) =>
      prev.map((r) =>
        r.id === id
          ? { ...r, status, decidedBy: me.id, decidedAt: new Date().toISOString() }
          : r
      )
    );
    setDetailOpen(false);
  };

  const sortedRequests = [...requests].sort((a, b) => {
    if (a.status === "pending" && b.status !== "pending") return -1;
    if (a.status !== "pending" && b.status === "pending") return 1;
    return b.submittedAt.localeCompare(a.submittedAt);
  });

  const selectedEmployee = selectedRequest ? findEmployee(selectedRequest.employeeId) : undefined;
  // The formal-letter body is a fixed template the employee fills in
  // themselves (see lib/leave-email.ts) — only the auto-generated subject
  // (name + dates) is meaningful here. Attachments are ephemeral local
  // state on the employee's own /leave page, not part of the shared mock
  // model, so there's nothing to surface for them on the admin side yet.
  const selectedSubject = selectedRequest
    ? buildLeaveRequestEmail({
        employeeName: selectedEmployee ? `${selectedEmployee.firstName} ${selectedEmployee.lastName}` : selectedRequest.employeeId,
        yearOfStudy: "",
        studentId: "",
        phoneNumber: "",
        leaveType: selectedRequest.leaveType ?? "",
        startDate: selectedRequest.startDate,
        endDate: selectedRequest.endDate,
        reason: selectedRequest.reason ?? "",
      }).subject
    : "";

  return (
    <main className="flex flex-1 flex-col gap-6 p-6">
      <AdminPageHeader title="Leave requests" subtitle="Review and approve pending requests" />

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Approval queue</CardTitle>
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
                <TableHead>Leave type</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRequests.map((request) => (
                <TableRow
                  key={request.id}
                  className="cursor-pointer"
                  onClick={() => {
                    setSelectedRequest(request);
                    setDetailOpen(true);
                  }}
                >
                  <TableCell className="font-medium text-foreground">
                    {employeeName(request.employeeId)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {request.leaveType ?? "-"}
                  </TableCell>
                  <TableCell>{formatDateRange(request.startDate, request.endDate)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatSubmitted(request.submittedAt)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusBadgeVariant[request.status]} className="capitalize">
                      {request.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {request.status === "pending" && (
                      <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="sm"
                          className="cursor-pointer bg-success-foreground text-white hover:bg-success-foreground/90"
                          onClick={() => decide(request.id, "approved")}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="cursor-pointer"
                          onClick={() => decide(request.id, "rejected")}
                        >
                          Decline
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

      <AdminDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        icon={CalendarRange}
        title={selectedSubject}
        badgeText={selectedRequest ? selectedRequest.status : ""}
        badgeVariant={selectedRequest ? statusBadgeVariant[selectedRequest.status] : "warning"}
        footer={
          selectedRequest?.status === "pending" ? (
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                className="cursor-pointer"
                onClick={() => decide(selectedRequest.id, "rejected")}
              >
                <X className="size-4" />
                Decline
              </Button>
              <Button
                className="cursor-pointer bg-accent-600 text-white hover:bg-accent-700"
                onClick={() => decide(selectedRequest.id, "approved")}
              >
                <Check className="size-4" />
                Approve
              </Button>
            </div>
          ) : undefined
        }
      >
        {selectedRequest && (
          <div className="flex flex-col gap-3">
            <AdminDetailInfoBlock
              label="Dates"
              value={formatDateRange(selectedRequest.startDate, selectedRequest.endDate)}
              valueSize="sm"
            />
            <AdminDetailInfoBlock label="Reason" value={selectedRequest.reason ?? "-"} valueSize="sm" />
            <p className="text-xs text-muted-foreground">
              Submitted {formatSubmitted(selectedRequest.submittedAt)}
            </p>
          </div>
        )}
      </AdminDetailDialog>
    </main>
  );
}

"use client";

import { useState } from "react";
import { CalendarRange, Check, X } from "lucide-react";

import { AdminDetailDialog, AdminDetailInfoBlock } from "@/components/admin-detail-dialog";
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
import { cn, formatThaiDate, formatThaiDateRange } from "@/lib/utils";

const statusBadgeVariant: Record<LeaveStatus, "warning" | "success" | "danger"> = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
};

const statusLabelTh: Record<LeaveStatus, string> = {
  pending: "รอดำเนินการ",
  approved: "อนุมัติแล้ว",
  rejected: "ปฏิเสธแล้ว",
};

function findEmployee(employeeId: string) {
  return mockEmployees.find((e) => e.id === employeeId);
}

function employeeName(employeeId: string): string {
  const employee = findEmployee(employeeId);
  return employee ? `${employee.firstName} ${employee.lastName}` : employeeId;
}

function LeaveRequestTable({
  requests,
  showActions,
  onRowClick,
  onDecide,
}: {
  requests: MockLeaveRequest[];
  showActions: boolean;
  onRowClick: (request: MockLeaveRequest) => void;
  onDecide: (id: string, status: "approved" | "rejected") => void;
}) {
  // table-fixed + matching widths on every column, so the รอดำเนินการ and
  // ดำเนินการแล้ว tables (two separate <table> elements) line up column-for-
  // column instead of each auto-sizing to its own content — same fix as
  // admin/holidays/page.tsx.
  return (
    <Table className="table-fixed">
      <TableHeader>
        <TableRow>
          <TableHead className="w-[22%]">พนักงาน</TableHead>
          <TableHead className="w-[15%]">ประเภทการลา</TableHead>
          <TableHead className="w-[20%]">วันที่ลา</TableHead>
          <TableHead className="w-[15%]">วันที่ส่งคำขอ</TableHead>
          <TableHead className="w-[13%]">สถานะ</TableHead>
          <TableHead className="w-[15%] text-center">จัดการ</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {requests.map((request) => (
          <TableRow
            key={request.id}
            className="cursor-pointer"
            onClick={() => onRowClick(request)}
          >
            <TableCell className="truncate font-medium text-foreground">
              {employeeName(request.employeeId)}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {request.leaveType ?? "-"}
            </TableCell>
            <TableCell>{formatThaiDateRange(request.startDate, request.endDate)}</TableCell>
            <TableCell className="text-muted-foreground">
              {formatThaiDate(new Date(request.submittedAt))}
            </TableCell>
            <TableCell>
              <Badge variant={statusBadgeVariant[request.status]}>
                {statusLabelTh[request.status]}
              </Badge>
            </TableCell>
            <TableCell className="text-center">
              {showActions && (
                <div className="flex justify-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <Button
                    size="sm"
                    className="cursor-pointer bg-success-foreground text-white hover:bg-success-foreground/90"
                    onClick={() => onDecide(request.id, "approved")}
                  >
                    อนุมัติ
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="cursor-pointer"
                    onClick={() => onDecide(request.id, "rejected")}
                  >
                    ปฏิเสธ
                  </Button>
                </div>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
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

  const openDetail = (request: MockLeaveRequest) => {
    setSelectedRequest(request);
    setDetailOpen(true);
  };

  const sortedRequests = [...requests].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  const pendingRequests = sortedRequests.filter((r) => r.status === "pending");
  const handledRequests = sortedRequests.filter((r) => r.status !== "pending");

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
    <main className="flex flex-1 flex-col gap-6 px-6 pb-6">
      <header className="relative shrink-0 overflow-hidden rounded-b-[20px] bg-brand-600 px-6 py-6 text-white">
        <div className="absolute top-0 right-0 size-40 -translate-y-1/3 translate-x-1/4 rounded-full bg-white/10" />
        <div className="relative">
          <h1 className="text-2xl font-bold">คำขอลา</h1>
          <p className="mt-1 text-sm text-white/80">ตรวจสอบและอนุมัติคำขอที่รอดำเนินการ</p>
        </div>
      </header>

      <Card className="rounded-2xl border border-slate-200 ring-0">
        <CardHeader>
          <CardTitle>รายการคำขอลา</CardTitle>
          <p className="text-sm text-muted-foreground">
            ระบบสำรองในแอป — สามารถอนุมัติผ่านลิงก์ในอีเมลที่ส่งไปพร้อมคำขอแต่ละรายการได้เช่นกัน
          </p>
        </CardHeader>
        <CardContent>
          {pendingRequests.length > 0 && (
            <>
              <p className="text-xs font-semibold text-muted-foreground">รอดำเนินการ</p>
              <div className="mt-2">
                <LeaveRequestTable
                  requests={pendingRequests}
                  showActions
                  onRowClick={openDetail}
                  onDecide={decide}
                />
              </div>
            </>
          )}

          {handledRequests.length > 0 && (
            <>
              <p
                className={cn(
                  "text-xs font-semibold text-muted-foreground",
                  pendingRequests.length > 0 && "mt-6"
                )}
              >
                ดำเนินการแล้ว
              </p>
              <div className="mt-2">
                <LeaveRequestTable
                  requests={handledRequests}
                  showActions={false}
                  onRowClick={openDetail}
                  onDecide={decide}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <AdminDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        icon={CalendarRange}
        title={selectedSubject}
        badgeText={selectedRequest ? statusLabelTh[selectedRequest.status] : ""}
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
                ปฏิเสธ
              </Button>
              <Button
                className="cursor-pointer bg-success-foreground text-white hover:bg-success-foreground/90"
                onClick={() => decide(selectedRequest.id, "approved")}
              >
                <Check className="size-4" />
                อนุมัติ
              </Button>
            </div>
          ) : undefined
        }
      >
        {selectedRequest && (
          <div className="flex flex-col gap-3">
            <AdminDetailInfoBlock
              label="วันที่ลา"
              value={formatThaiDateRange(selectedRequest.startDate, selectedRequest.endDate)}
              valueSize="sm"
            />
            <AdminDetailInfoBlock label="เหตุผล" value={selectedRequest.reason ?? "-"} valueSize="sm" />
            <p className="text-xs text-muted-foreground">
              ส่งคำขอเมื่อ {formatThaiDate(new Date(selectedRequest.submittedAt))}
            </p>
          </div>
        )}
      </AdminDetailDialog>
    </main>
  );
}

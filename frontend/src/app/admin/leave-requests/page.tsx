"use client";

import { useEffect, useState } from "react";
import { CalendarRange, Check, Eye, X } from "lucide-react";

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
import { approveLeaveRequest, listAllLeaveRequests, rejectLeaveRequest } from "@/lib/api-leave";
import { getEmployeesByIds, type Employee } from "@/lib/api-employees";
import { buildLeaveRequestEmail } from "@/lib/leave-email";
import { type LeaveStatus, type MockLeaveRequest } from "@/lib/mock-data";
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

// Never returns null silently: while the lookup is still in flight this
// shows a loading placeholder, and if the lookup fails or the id wasn't
// found this falls back to the raw id with a visible "name unavailable"
// marker — never a blank cell, and never a stale mock name.
function employeeDisplayName(
  employeeId: string,
  employeesById: Map<string, Employee>,
  employeesLoading: boolean
): { text: string; unavailable: boolean } {
  const employee = employeesById.get(employeeId);
  if (employee) {
    const name = [employee.firstName, employee.lastName].filter(Boolean).join(" ");
    if (name) return { text: name, unavailable: false };
    // Found the employee but they have no name yet (registration not
    // completed) — LINE display name is the next-best identifier, still not
    // a lookup failure.
    if (employee.lineDisplayName) return { text: employee.lineDisplayName, unavailable: false };
  }
  if (employeesLoading) {
    return { text: "กำลังโหลด…", unavailable: false };
  }
  return { text: employeeId, unavailable: true };
}

function LeaveRequestTable({
  requests,
  showActions,
  onRowClick,
  onDecide,
  employeesById,
  employeesLoading,
}: {
  requests: MockLeaveRequest[];
  showActions: boolean;
  onRowClick: (request: MockLeaveRequest) => void;
  onDecide: (id: string, status: "approved" | "rejected") => void;
  employeesById: Map<string, Employee>;
  employeesLoading: boolean;
}) {
  // table-fixed + matching widths on every column, so the รอดำเนินการ and
  // ดำเนินการแล้ว tables (two separate <table> elements) line up column-for-
  // column instead of each auto-sizing to its own content — same fix as
  // admin/holidays/page.tsx.
  return (
    <Table className="table-fixed">
      <TableHeader>
        <TableRow>
          <TableHead className="w-[20%]">พนักงาน</TableHead>
          <TableHead className="w-[14%]">ประเภทการลา</TableHead>
          <TableHead className="w-[19%]">วันที่ลา</TableHead>
          <TableHead className="w-[14%]">วันที่ส่งคำขอ</TableHead>
          <TableHead className="w-[13%]">สถานะ</TableHead>
          <TableHead className="w-[20%] text-center">จัดการ</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {requests.map((request) => {
          const { text: employeeText, unavailable } = employeeDisplayName(
            request.employeeId,
            employeesById,
            employeesLoading
          );
          return (
            <TableRow key={request.id}>
              <TableCell className="truncate font-medium text-foreground">
                {unavailable ? (
                  <span title="ไม่สามารถโหลดชื่อพนักงานได้" className="text-muted-foreground">
                    {employeeText} <span className="text-xs">(ไม่พบชื่อ)</span>
                  </span>
                ) : (
                  employeeText
                )}
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
              <TableCell>
                {/* Two grid slots instead of one centered flex group: the
                    auto slot pins the eye icon to the same x on every row
                    regardless of the อนุมัติ/ปฏิเสธ buttons' width. */}
                <div className="grid grid-cols-[1fr_auto] items-center gap-1.5">
                  <div className="flex items-center justify-end gap-1.5">
                    {/* Rendered for every row, not just showActions ones —
                        an already-decided row keeps both buttons visible
                        but disabled instead of removing them, so the row
                        still reads as "this is where you'd act" even after
                        the decision. */}
                    <Button
                      size="sm"
                      disabled={!showActions}
                      className="bg-success-foreground text-white hover:bg-success-foreground/90"
                      onClick={() => onDecide(request.id, "approved")}
                    >
                      อนุมัติ
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!showActions}
                      onClick={() => onDecide(request.id, "rejected")}
                    >
                      ปฏิเสธ
                    </Button>
                  </div>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="ดูรายละเอียด"
                    className="text-muted-foreground"
                    onClick={() => onRowClick(request)}
                  >
                    <Eye />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

export default function LeaveRequestsPage() {
  const [requests, setRequests] = useState<MockLeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<MockLeaveRequest | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const [employeesById, setEmployeesById] = useState<Map<string, Employee>>(new Map());
  const [employeesLoading, setEmployeesLoading] = useState(false);

  useEffect(() => {
    listAllLeaveRequests()
      .then((rows) => {
        setRequests(rows);
        // Resolves every distinct employee referenced by this load in one
        // batch (see getEmployeesByIds — there's no batch-by-ids endpoint
        // yet, so this is N parallel single-employee lookups deduplicated
        // by id). Chained here rather than a separate effect reacting to
        // `requests`: employeeId never changes for a request once loaded
        // (decide() below only ever updates status/decided fields), so
        // there's nothing to re-resolve after an approve/reject.
        const ids = rows.map((r) => r.employeeId);
        setEmployeesLoading(true);
        getEmployeesByIds(ids)
          .then((resolved) => setEmployeesById(resolved))
          .finally(() => setEmployeesLoading(false));
      })
      .catch((err: Error) => setLoadError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const decide = async (id: string, status: "approved" | "rejected") => {
    setActionError(null);
    try {
      const decided = status === "approved" ? await approveLeaveRequest(id) : await rejectLeaveRequest(id);
      setRequests((prev) => prev.map((r) => (r.id === id ? decided : r)));
      setDetailOpen(false);
    } catch (err) {
      // A 409 here means someone else already decided it between page load
      // and this click — the decision is final either way, so surface the
      // message rather than silently retrying.
      setActionError(err instanceof Error ? err.message : "ดำเนินการไม่สำเร็จ");
    }
  };

  const openDetail = (request: MockLeaveRequest) => {
    setSelectedRequest(request);
    setDetailOpen(true);
  };

  const sortedRequests = [...requests].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  const pendingRequests = sortedRequests.filter((r) => r.status === "pending");
  const handledRequests = sortedRequests.filter((r) => r.status !== "pending");

  const selectedEmployeeName = selectedRequest
    ? employeeDisplayName(selectedRequest.employeeId, employeesById, employeesLoading).text
    : "";
  // The formal-letter body is a fixed template the employee fills in
  // themselves (see lib/leave-email.ts) — only the auto-generated subject
  // (name + dates) is meaningful here. Attachments are ephemeral local
  // state on the employee's own /leave page, not part of the shared mock
  // model, so there's nothing to surface for them on the admin side yet.
  const selectedSubject = selectedRequest
    ? buildLeaveRequestEmail({
        employeeName: selectedEmployeeName,
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
          {actionError && (
            <p className="mb-4 rounded-md border border-danger bg-danger px-3 py-2 text-sm text-danger-foreground">
              {actionError}
            </p>
          )}

          {loading && <p className="text-sm text-muted-foreground">กำลังโหลด…</p>}
          {!loading && loadError && (
            <p className="text-sm text-danger-foreground">โหลดข้อมูลไม่สำเร็จ: {loadError}</p>
          )}

          {!loading && !loadError && pendingRequests.length > 0 && (
            <>
              <p className="text-xs font-semibold text-muted-foreground">รอดำเนินการ</p>
              <div className="mt-2">
                <LeaveRequestTable
                  requests={pendingRequests}
                  showActions
                  onRowClick={openDetail}
                  onDecide={decide}
                  employeesById={employeesById}
                  employeesLoading={employeesLoading}
                />
              </div>
            </>
          )}

          {!loading && !loadError && handledRequests.length > 0 && (
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
                  employeesById={employeesById}
                  employeesLoading={employeesLoading}
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

"use client";

import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarRange, ChevronDown, ChevronUp, FileText, Image as ImageIcon, Mail, Upload, X } from "lucide-react";
import { z } from "zod";

import { DetailModal } from "@/components/detail-modal";
import { EmployeeListRow } from "@/components/employee-list-row";
import { EmployeePageHeader } from "@/components/employee-page-header";
import {
  EmployeeSheet,
  EmployeeSheetContent,
  EmployeeSheetHeader,
  EmployeeSheetTitle,
} from "@/components/employee-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { buildLeaveRequestEmail } from "@/lib/leave-email";
import {
  getLeaveRequestsForEmployee,
  getYearOfStudy,
  mockEmployees,
  type LeaveStatus,
  type MockLeaveRequest,
} from "@/lib/mock-data";
import { useMe } from "@/lib/session";
import { cn } from "@/lib/utils";

const fieldClass =
  "h-12 rounded-xl border-border bg-muted/40 px-3 text-sm placeholder:text-sm focus-visible:border-brand-600 focus-visible:bg-card focus-visible:ring-brand-600/20";

const leaveRequestSchema = z
  .object({
    leave_type: z.string().trim().min(1, "กรุณาระบุประเภทการลา"),
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

const VISIBLE_LEAVE_REQUESTS = 5;

function EmailContentBlock({ subject, body }: { subject: string; body: string }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto rounded-xl bg-slate-50 px-4 py-3.5">
      <p className="text-xs text-muted-foreground">หัวข้อ</p>
      <p className="text-sm font-semibold text-foreground">{subject}</p>
      <div className="mt-3 border-t border-border pt-3">
        <p className="text-sm leading-relaxed whitespace-pre-line text-foreground">{body}</p>
      </div>
    </div>
  );
}

type LeaveAttachment = { id: string; name: string; isImage: boolean; size: number };

function formatFileSize(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function AttachmentRow({
  attachment,
  onRemove,
}: {
  attachment: LeaveAttachment;
  onRemove?: () => void;
}) {
  const AttachmentIcon = attachment.isImage ? ImageIcon : FileText;
  return (
    <div className="flex items-center gap-2 rounded-xl bg-muted/40 px-3 py-2">
      <AttachmentIcon className="size-4 shrink-0 text-brand-600" />
      <p className="min-w-0 flex-1 truncate text-xs text-foreground">
        {attachment.name}{" "}
        <span className="text-muted-foreground">({formatFileSize(attachment.size)})</span>
      </p>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label="ลบไฟล์แนบ"
          className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

export default function LeavePage() {
  const me = useMe();
  const [requests, setRequests] = useState<MockLeaveRequest[]>(() => getLeaveRequestsForEmployee(me.id));
  const [showPreview, setShowPreview] = useState(false);
  const [requestListExpanded, setRequestListExpanded] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<MockLeaveRequest | null>(null);
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [attachments, setAttachments] = useState<LeaveAttachment[]>([]);
  const [attachmentsByRequestId, setAttachmentsByRequestId] = useState<Record<string, LeaveAttachment[]>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAttachmentSelect = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const newAttachments = Array.from(fileList).map((file) => ({
      id: crypto.randomUUID(),
      name: file.name,
      isImage: file.type.startsWith("image/"),
      size: file.size,
    }));
    setAttachments((prev) => [...prev, ...newAttachments]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<LeaveRequestForm>({
    resolver: zodResolver(leaveRequestSchema),
  });

  const leaveType = watch("leave_type");
  const startDate = watch("start_date");
  const endDate = watch("end_date");
  const reason = watch("reason");

  const mockProfile = mockEmployees.find((e) => e.id === me.id);
  const employeeName = [me.first_name, me.last_name].filter(Boolean).join(" ") || me.display_name || "-";
  const yearOfStudy = getYearOfStudy(mockProfile?.studentGen ?? null);
  const studentId = mockProfile?.studentId ?? "-";
  const phoneNumber = mockProfile?.phoneNumber ?? "-";

  // The subject is fully derived from the name/dates/type below — not a
  // form field — so it can never go stale the way an editable-but-synced
  // field would (e.g. silently stop following the picked dates after
  // someone types into it).
  const { subject: autoSubject, body: emailBody } = buildLeaveRequestEmail({
    employeeName,
    yearOfStudy,
    studentId,
    phoneNumber,
    leaveType: leaveType ?? "",
    startDate: startDate ?? "",
    endDate: endDate ?? "",
    reason: reason ?? "",
    attachmentCount: attachments.length,
  });

  const onSubmit = (values: LeaveRequestForm) => {
    const newRequest: MockLeaveRequest = {
      id: `leave-local-${crypto.randomUUID()}`,
      employeeId: me.id,
      leaveType: values.leave_type,
      startDate: values.start_date,
      endDate: values.end_date,
      reason: values.reason,
      status: "pending",
      decidedBy: null,
      decidedAt: null,
    };
    setRequests((prev) => [newRequest, ...prev]);
    if (attachments.length > 0) {
      setAttachmentsByRequestId((prev) => ({ ...prev, [newRequest.id]: attachments }));
    }
    reset();
    setAttachments([]);
    setShowPreview(false);
  };

  const visibleRequests = requestListExpanded
    ? requests
    : requests.slice(0, VISIBLE_LEAVE_REQUESTS);
  const hiddenRequestCount = requests.length - VISIBLE_LEAVE_REQUESTS;

  const selectedRequestAttachments = selectedRequest
    ? (attachmentsByRequestId[selectedRequest.id] ?? [])
    : [];

  // The full formal-letter body (buildLeaveRequestEmail) is only for the
  // form's live "ตัวอย่างอีเมล" preview below. Once a request is submitted,
  // its detail view shows the subject alongside the reason exactly as
  // typed — not re-wrapped in the letter template — so what you see there
  // always matches what you wrote, verbatim.
  const selectedRequestSubject = selectedRequest
    ? buildLeaveRequestEmail({
      employeeName,
      yearOfStudy,
      studentId,
      phoneNumber,
      leaveType: selectedRequest.leaveType ?? "",
      startDate: selectedRequest.startDate,
      endDate: selectedRequest.endDate,
      reason: selectedRequest.reason ?? "",
      attachmentCount: selectedRequestAttachments.length,
    }).subject
    : "";

  return (
    <div className="flex w-full flex-1 flex-col">
      <EmployeePageHeader title="ขอลา" subtitle="จัดการคำขอลาของคุณ" />

      <div className="flex flex-col gap-6 px-6 py-6">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>ยื่นคำขอลา</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex items-start gap-3 rounded-xl bg-brand-100 p-4">
              <Mail className="mt-0.5 size-4 shrink-0 text-brand-600" />
              <p className="text-xs leading-relaxed text-brand-600">
                คำขอนี้จะถูกส่งเป็นอีเมลถึงหัวหน้างานของคุณโดยตรง
                <br />
                กรุณาเขียนด้วยถ้อยคำสุภาพและเป็นทางการ
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="subject" className="text-xs text-muted-foreground">
                    หัวข้อ
                  </Label>
                  <button
                    type="button"
                    onClick={() => setShowPreview(true)}
                    className="flex items-center gap-1 text-xs font-medium text-brand-600 cursor-pointer"
                  >
                    <Mail className="size-3.5" />
                    ตัวอย่างอีเมล
                  </button>
                </div>
                <Input
                  id="subject"
                  readOnly
                  value={autoSubject}
                  className={cn(fieldClass, "cursor-default bg-muted/60")}
                />
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  อัปเดตวันเวลาทันทีเมื่อเลือกวันที่ด้านล่าง
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="leave_type" className="text-xs text-muted-foreground">
                  ประเภทการลา<span className="text-danger-foreground">*</span>
                </Label>
                <Input
                  id="leave_type"
                  placeholder="เช่น ป่วย, กิจส่วนตัว, พักร้อน"
                  className={fieldClass}
                  {...register("leave_type")}
                />
                {errors.leave_type && (
                  <p className="text-xs text-danger-foreground">{errors.leave_type.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="start_date" className="text-xs text-muted-foreground">
                    วันที่เริ่มลา<span className="text-danger-foreground">*</span>
                  </Label>
                  <Input id="start_date" type="date" className={fieldClass} {...register("start_date")} />
                  {errors.start_date && (
                    <p className="text-xs text-danger-foreground">{errors.start_date.message}</p>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="end_date" className="text-xs text-muted-foreground">
                    วันที่สิ้นสุด<span className="text-danger-foreground">*</span>
                  </Label>
                  <Input id="end_date" type="date" className={fieldClass} {...register("end_date")} />
                  {errors.end_date && (
                    <p className="text-xs text-danger-foreground">{errors.end_date.message}</p>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="reason" className="text-xs text-muted-foreground">
                  เหตุผล<span className="text-danger-foreground">*</span>
                </Label>
                <Textarea
                  id="reason"
                  placeholder="เรียนหัวหน้างาน..."
                  className={cn(fieldClass, "min-h-32 py-3")}
                  {...register("reason")}
                />
                {errors.reason && (
                  <p className="text-xs text-danger-foreground">{errors.reason.message}</p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf"
                  capture="environment"
                  multiple
                  className="hidden"
                  onChange={(e) => handleAttachmentSelect(e.target.files)}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-brand-600/40 text-sm font-medium text-brand-600 transition-colors hover:bg-brand-100"
                >
                  <Upload className="size-4" />
                  เพิ่มเอกสารแนบ (ถ้ามี)
                </button>

                {attachments.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    {attachments.map((attachment) => (
                      <AttachmentRow
                        key={attachment.id}
                        attachment={attachment}
                        onRemove={() => removeAttachment(attachment.id)}
                      />
                    ))}
                  </div>
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
            {visibleRequests.map((request, index) => {
              const { subject: requestSubject } = buildLeaveRequestEmail({
                employeeName,
                yearOfStudy,
                studentId,
                phoneNumber,
                leaveType: request.leaveType ?? "",
                startDate: request.startDate,
                endDate: request.endDate,
                reason: request.reason ?? "",
              });
              return (
                <EmployeeListRow
                  key={request.id}
                  icon={CalendarRange}
                  label={requestSubject}
                  sublabel={request.reason ?? undefined}
                  trailing={
                    <Badge variant={statusBadgeVariant[request.status]}>
                      {statusLabelTh[request.status]}
                    </Badge>
                  }
                  onClick={() => {
                    setSelectedRequest(request);
                    setRequestModalOpen(true);
                  }}
                  className={
                    index >= VISIBLE_LEAVE_REQUESTS
                      ? "duration-200 animate-in slide-in-from-top-2"
                      : undefined
                  }
                />
              );
            })}
            {hiddenRequestCount > 0 && (
              <button
                type="button"
                onClick={() => setRequestListExpanded((v) => !v)}
                className="mt-3 flex cursor-pointer items-center gap-1 self-start text-xs font-medium text-brand-600"
              >
                {requestListExpanded ? "ย่อกลับ" : `ดูเพิ่มเติม (${hiddenRequestCount} รายการ)`}
                {requestListExpanded ? (
                  <ChevronUp className="size-3.5" />
                ) : (
                  <ChevronDown className="size-3.5" />
                )}
              </button>
            )}
          </CardContent>
        </Card>
      </div>

      <DetailModal
        open={requestModalOpen}
        onOpenChange={setRequestModalOpen}
        icon={CalendarRange}
        title={selectedRequestSubject}
        badgeText={selectedRequest ? statusLabelTh[selectedRequest.status] : ""}
        badgeVariant={selectedRequest ? statusBadgeVariant[selectedRequest.status] : "warning"}
      >
        {selectedRequest && (
          <EmailContentBlock subject={selectedRequestSubject} body={selectedRequest.reason ?? ""} />
        )}
        {selectedRequestAttachments.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {selectedRequestAttachments.map((attachment) => (
              <AttachmentRow key={attachment.id} attachment={attachment} />
            ))}
          </div>
        )}
      </DetailModal>

      <EmployeeSheet open={showPreview} onOpenChange={setShowPreview}>
        <EmployeeSheetContent className="flex flex-col gap-4">
          <EmployeeSheetHeader className="flex-row items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-600">
              <Mail className="size-5" />
            </div>
            <div className="flex flex-col items-start gap-1">
              <EmployeeSheetTitle className="text-base font-bold">ตัวอย่างอีเมล</EmployeeSheetTitle>
              <Badge>จะส่งถึงหัวหน้างานของคุณ</Badge>
            </div>
          </EmployeeSheetHeader>

          <div className="border-t border-border" />

          <EmailContentBlock subject={autoSubject} body={emailBody} />

          <Button
            className="h-11 w-full rounded-full bg-accent-600 font-semibold text-white hover:bg-accent-700"
            onClick={() => setShowPreview(false)}
          >
            ปิด
          </Button>
        </EmployeeSheetContent>
      </EmployeeSheet>
    </div>
  );
}

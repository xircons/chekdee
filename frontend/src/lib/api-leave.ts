import { apiFetch } from "@/lib/api";
import type { LeaveStatus, MockLeaveRequest } from "@/lib/mock-data";

// Wire-format shape from GET/POST /leave-requests (snake_case, per
// openapi/openapi.yaml's LeaveRequest schema) — mapped to MockLeaveRequest's
// camelCase shape so the existing page components don't need to change.
type LeaveRequestResponse = {
  id: string;
  employee_id: string;
  leave_type: string | null;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: LeaveStatus;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
};

function toLeaveRequest(r: LeaveRequestResponse): MockLeaveRequest {
  return {
    id: r.id,
    employeeId: r.employee_id,
    leaveType: r.leave_type,
    startDate: r.start_date,
    endDate: r.end_date,
    reason: r.reason,
    status: r.status,
    submittedAt: r.created_at,
    decidedBy: r.decided_by,
    decidedAt: r.decided_at,
  };
}

async function parseOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message ?? `คำขอไม่สำเร็จ (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export async function listMyLeaveRequests(): Promise<MockLeaveRequest[]> {
  const res = await apiFetch("/leave-requests/me");
  const rows = await parseOrThrow<LeaveRequestResponse[]>(res);
  return rows.map(toLeaveRequest);
}

// Admin org-wide view — pending sorted first, per the backend's ListAll.
export async function listAllLeaveRequests(): Promise<MockLeaveRequest[]> {
  const res = await apiFetch("/leave-requests");
  const rows = await parseOrThrow<LeaveRequestResponse[]>(res);
  return rows.map(toLeaveRequest);
}

export async function createLeaveRequest(input: {
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string;
}): Promise<MockLeaveRequest> {
  const res = await apiFetch("/leave-requests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return toLeaveRequest(await parseOrThrow<LeaveRequestResponse>(res));
}

export async function approveLeaveRequest(id: string): Promise<MockLeaveRequest> {
  const res = await apiFetch(`/leave-requests/${id}/approve`, { method: "POST" });
  return toLeaveRequest(await parseOrThrow<LeaveRequestResponse>(res));
}

export async function rejectLeaveRequest(id: string): Promise<MockLeaveRequest> {
  const res = await apiFetch(`/leave-requests/${id}/reject`, { method: "POST" });
  return toLeaveRequest(await parseOrThrow<LeaveRequestResponse>(res));
}

// Wire-format shape from the /leave-requests/:id/attachments endpoints
// (snake_case, per openapi/openapi.yaml's LeaveAttachment schema) — file
// bytes are never included here, only metadata; see downloadLeaveAttachment
// for the actual file.
type LeaveAttachmentResponse = {
  id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  created_at: string;
};

export type LeaveAttachment = {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
};

function toLeaveAttachment(r: LeaveAttachmentResponse): LeaveAttachment {
  return {
    id: r.id,
    filename: r.filename,
    contentType: r.content_type,
    sizeBytes: r.size_bytes,
    createdAt: r.created_at,
  };
}

// No explicit Content-Type header -- apiFetch never forces one, and the
// browser needs to set multipart/form-data itself (with its own boundary)
// when the body is a FormData, which a manually-set header would break.
export async function uploadLeaveAttachment(
  leaveRequestId: string,
  file: File
): Promise<LeaveAttachment> {
  const body = new FormData();
  body.append("file", file);
  const res = await apiFetch(`/leave-requests/${leaveRequestId}/attachments`, {
    method: "POST",
    body,
  });
  return toLeaveAttachment(await parseOrThrow<LeaveAttachmentResponse>(res));
}

export async function listLeaveAttachments(leaveRequestId: string): Promise<LeaveAttachment[]> {
  const res = await apiFetch(`/leave-requests/${leaveRequestId}/attachments`);
  const rows = await parseOrThrow<LeaveAttachmentResponse[]>(res);
  return rows.map(toLeaveAttachment);
}

// Returns an object URL, not the raw Blob -- the download/preview endpoint
// is bearer-authenticated, so callers can't just point an <a href> or <img
// src> at it directly; this fetches it once (with the auth header apiFetch
// already attaches) and hands back a URL those elements can use instead.
// Callers must revokeObjectURL it when done (e.g. on modal close) to avoid
// leaking memory.
export async function openLeaveAttachment(leaveRequestId: string, attachmentId: string): Promise<string> {
  const res = await apiFetch(`/leave-requests/${leaveRequestId}/attachments/${attachmentId}`);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message ?? `คำขอไม่สำเร็จ (${res.status})`);
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

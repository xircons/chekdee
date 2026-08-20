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
    throw new Error(body?.message ?? `Request failed (${res.status})`);
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

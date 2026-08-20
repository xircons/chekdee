import { apiFetch } from "@/lib/api";

// Wire-format shape from GET /employees and GET /employees/:id (snake_case,
// per openapi/openapi.yaml's Employee schema).
type EmployeeResponse = {
  id: string;
  role: "system_owner" | "admin" | "supervisor" | "employee";
  status: "active" | "inactive";
  team_id: string | null;
  first_name: string | null;
  last_name: string | null;
  student_gen: string | null;
  line_display_name: string | null;
  line_picture_url: string | null;
  registration_completed_at: string | null;
  offboarded_at: string | null;
  offboarded_reason: string | null;
  created_at: string;
};

export type Employee = {
  id: string;
  role: EmployeeResponse["role"];
  status: EmployeeResponse["status"];
  teamId: string | null;
  firstName: string | null;
  lastName: string | null;
  studentGen: string | null;
  lineDisplayName: string | null;
  linePictureUrl: string | null;
  registrationCompletedAt: string | null;
  offboardedAt: string | null;
  offboardedReason: string | null;
  createdAt: string;
};

// Not mapped onto MockEmployee — that fixture type has non-nullable
// firstName/lastName/teamId, but the real Employee response has all three
// nullable (an employee can exist before completing registration or being
// assigned a team). Force-fitting the mock shape would mean silently
// coercing nulls into empty strings instead of letting callers decide how
// to display "no name yet".
function toEmployee(r: EmployeeResponse): Employee {
  return {
    id: r.id,
    role: r.role,
    status: r.status,
    teamId: r.team_id,
    firstName: r.first_name,
    lastName: r.last_name,
    studentGen: r.student_gen,
    lineDisplayName: r.line_display_name,
    linePictureUrl: r.line_picture_url,
    registrationCompletedAt: r.registration_completed_at,
    offboardedAt: r.offboarded_at,
    offboardedReason: r.offboarded_reason,
    createdAt: r.created_at,
  };
}

async function parseOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export async function getEmployee(id: string): Promise<Employee> {
  const res = await apiFetch(`/employees/${id}`);
  return toEmployee(await parseOrThrow<EmployeeResponse>(res));
}

// Resolves several employee ids, deduplicated. GET /employees only filters
// by team_id/role/status/search — there's no "list of ids" batch endpoint
// yet, so this is N parallel GET /employees/:id calls rather than one
// request. Worth revisiting as a backend follow-up (an `ids` filter, or a
// POST /employees/lookup) if a page ends up needing this for a large
// distinct-employee count on every load.
//
// Uses allSettled, not all: one failed lookup (404, network error, ...)
// must not blank out every other row's name. Ids that fail to resolve are
// simply absent from the returned map — callers show a per-row fallback
// for just those, never a stale or fabricated name.
export async function getEmployeesByIds(ids: string[]): Promise<Map<string, Employee>> {
  const uniqueIds = [...new Set(ids)];
  const results = await Promise.allSettled(uniqueIds.map((id) => getEmployee(id)));

  const employees = new Map<string, Employee>();
  results.forEach((result, i) => {
    if (result.status === "fulfilled") {
      employees.set(uniqueIds[i], result.value);
    }
  });
  return employees;
}

export type EmployeeRole = "admin" | "supervisor" | "employee";
export type EmployeeOffboardStatus = "active" | "offboarded";

export type EmployeeListFilter = {
  search?: string;
  role?: EmployeeRole;
  status?: EmployeeOffboardStatus;
  teamId?: string;
  limit?: number;
  offset?: number;
};

type EmployeeListResponse = {
  employees: EmployeeResponse[];
  total: number;
};

// GET /employees — filtering/pagination happens server-side (search matches
// first_name/last_name/line_display_name; status filters on offboarded_at,
// not the separate active/inactive status column — see EmployeeListFilter
// on the backend). Callers should not re-filter or re-paginate the result
// client-side; the returned `total` is the count before limit/offset.
export async function listEmployees(
  filter: EmployeeListFilter = {}
): Promise<{ employees: Employee[]; total: number }> {
  const params = new URLSearchParams();
  if (filter.search) params.set("search", filter.search);
  if (filter.role) params.set("role", filter.role);
  if (filter.status) params.set("status", filter.status);
  if (filter.teamId) params.set("team_id", filter.teamId);
  if (filter.limit != null) params.set("limit", String(filter.limit));
  if (filter.offset != null) params.set("offset", String(filter.offset));

  const qs = params.toString();
  const res = await apiFetch(`/employees${qs ? `?${qs}` : ""}`);
  const body = await parseOrThrow<EmployeeListResponse>(res);
  return { employees: body.employees.map(toEmployee), total: body.total };
}

// PATCH /employees/:id — profile fields only. The backend does not accept
// student_gen (set only once, during the employee's own LINE registration)
// or anything else here; see UpdateEmployeeRequest in openapi.yaml.
export async function updateEmployee(
  id: string,
  input: { firstName: string; lastName: string; teamId: string | null }
): Promise<Employee> {
  const res = await apiFetch(`/employees/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      first_name: input.firstName,
      last_name: input.lastName,
      team_id: input.teamId,
    }),
  });
  return toEmployee(await parseOrThrow<EmployeeResponse>(res));
}

// PATCH /employees/:id/role — a separate, more sensitive, audit-logged
// action from updateEmployee above (matches the backend's own separation).
// Rejects (403) a transition to/from system_owner, and (403) an actor who
// doesn't outrank both the target's current role and the requested role.
export async function updateEmployeeRole(id: string, role: EmployeeRole): Promise<Employee> {
  const res = await apiFetch(`/employees/${id}/role`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role }),
  });
  return toEmployee(await parseOrThrow<EmployeeResponse>(res));
}

// POST /employees/:id/offboard — soft-delete. Rejects (403) a system_owner
// target, (409) an already-offboarded target, and (403) an actor who
// doesn't outrank the target's current role.
export async function offboardEmployee(id: string, reason?: string): Promise<Employee> {
  const res = await apiFetch(`/employees/${id}/offboard`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason: reason ?? "" }),
  });
  return toEmployee(await parseOrThrow<EmployeeResponse>(res));
}

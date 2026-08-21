import { apiFetch } from "@/lib/api";
import type { MockHoliday } from "@/lib/mock-data";

// Wire-format shape from GET/POST/PUT /holidays (snake_case, per
// openapi/openapi.yaml's Holiday schema) — mapped to MockHoliday's
// camelCase shape so the existing page components don't need to change.
type HolidayResponse = {
  id: string;
  date: string;
  name: string;
  local_name: string | null;
  source: "nager_date" | "manual";
};

function toHoliday(r: HolidayResponse): MockHoliday {
  return { id: r.id, date: r.date, name: r.name, localName: r.local_name, source: r.source };
}

async function parseOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message ?? `คำขอไม่สำเร็จ (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export async function listHolidays(from: string, to: string): Promise<MockHoliday[]> {
  const res = await apiFetch(`/holidays?from=${from}&to=${to}`);
  const rows = await parseOrThrow<HolidayResponse[]>(res);
  return rows.map(toHoliday);
}

export async function createHoliday(input: {
  date: string;
  name: string;
  local_name: string;
}): Promise<MockHoliday> {
  const res = await apiFetch("/holidays", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return toHoliday(await parseOrThrow<HolidayResponse>(res));
}

// The backend only ever updates name/local_name — a holiday's date is
// immutable once created (see backend HolidayRepository.Update). The form
// must not let a user edit the date of an existing holiday, since that edit
// would be silently dropped by the API otherwise.
export async function updateHoliday(
  id: string,
  input: { name: string; local_name: string }
): Promise<MockHoliday> {
  const res = await apiFetch(`/holidays/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return toHoliday(await parseOrThrow<HolidayResponse>(res));
}

export async function deleteHoliday(id: string): Promise<void> {
  const res = await apiFetch(`/holidays/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message ?? `คำขอไม่สำเร็จ (${res.status})`);
  }
}

"use client";

import { useRouter } from "next/navigation";
import { GraduationCap, IdCard, LogOut, Phone } from "lucide-react";

import { EmployeeListRow } from "@/components/employee-list-row";
import { EmployeePageHeader } from "@/components/employee-page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { mockEmployees, ROLE_LABEL_TH } from "@/lib/mock-data";
import { useMe, logout } from "@/lib/session";

function studentGenLabel(gen: string): string {
  return `Gen (${gen})`;
}

function initials(first: string | null, last: string | null, fallback: string | null): string {
  if (first || last) {
    return `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase();
  }
  return (fallback ?? "?").slice(0, 2).toUpperCase();
}

export default function ProfilePage() {
  const me = useMe();
  const router = useRouter();

  // Enriches the real /auth/me fields with mock team/student-gen data
  // where the id happens to match a fixture — /auth/me doesn't return
  // those yet, so there's nothing to show for a non-mock session.
  const mockProfile = mockEmployees.find((e) => e.id === me.id);
  const fullName = [me.first_name, me.last_name].filter(Boolean).join(" ") || me.display_name || "—";

  return (
    <div className="flex w-full flex-1 flex-col">
      <EmployeePageHeader title="โปรไฟล์" />

      <div className="flex flex-col gap-6 px-6 pb-6">
        <Card className="-mt-6 rounded-2xl border border-slate-200 py-0 ring-0">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-brand-100 text-lg font-semibold text-brand-600">
              {initials(me.first_name, me.last_name, me.display_name)}
            </div>
            <div>
              <p className="text-lg font-semibold text-foreground">
                {fullName}
                {mockProfile?.nickname && (
                  <span className="font-normal text-muted-foreground"> ({mockProfile.nickname})</span>
                )}
              </p>
              <Badge variant="secondary" className="mt-1">
                {ROLE_LABEL_TH[me.role]}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {mockProfile && (
          <Card className="rounded-2xl border border-slate-200 ring-0">
            <CardHeader>
              <CardTitle>รายละเอียด</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col">
              {mockProfile.studentId && (
                <EmployeeListRow icon={IdCard} label="รหัสนักศึกษา" value={mockProfile.studentId} />
              )}
              {mockProfile.phoneNumber && (
                <EmployeeListRow icon={Phone} label="เบอร์โทรศัพท์" value={mockProfile.phoneNumber} />
              )}
              {mockProfile.studentGen && (
                <EmployeeListRow
                  icon={GraduationCap}
                  label="รุ่นนักศึกษา"
                  value={studentGenLabel(mockProfile.studentGen)}
                />
              )}
            </CardContent>
          </Card>
        )}

        <Button
          variant="outline"
          className="h-11 gap-2 rounded-full"
          onClick={() => {
            void logout().then(() => router.push("/login"));
          }}
        >
          <LogOut className="size-4" />
          ออกจากระบบ
        </Button>
      </div>
    </div>
  );
}

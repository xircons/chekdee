"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { devBypassAvailable, startDevSession } from "@/lib/dev-auth";
import { buildLineLoginURL } from "@/lib/line";
import type { Role } from "@/lib/session";

const devRoles: { role: Role; label: string }[] = [
  { role: "employee", label: "Employee" },
  { role: "supervisor", label: "Supervisor" },
  { role: "admin", label: "Admin" },
  { role: "system_owner", label: "System owner" },
];

export default function LoginPage() {
  const router = useRouter();
  const [pendingRole, setPendingRole] = useState<Role | null>(null);
  const [devError, setDevError] = useState<string | null>(null);

  return (
    <main className="flex min-h-full flex-1 items-center justify-center p-6">
      <div className="flex w-full max-w-sm flex-col gap-4">
        <Card className="rounded-2xl border border-slate-200 shadow-md ring-0">
          <CardHeader>
            <CardTitle className="text-center text-xl">Chekdee</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-center text-sm text-muted-foreground">
              เข้าสู่ระบบด้วยบัญชี LINE ของคุณเพื่อบันทึกเวลาเข้า-ออกงาน
            </p>
            <Button
              className="w-full bg-[#06C755] text-white hover:bg-[#05b34c]"
              onClick={() => {
                window.location.href = buildLineLoginURL();
              }}
            >
              เข้าสู่ระบบด้วย LINE
            </Button>
          </CardContent>
        </Card>

        {devBypassAvailable && (
          <Card className="rounded-2xl border border-dashed border-slate-200 shadow-none ring-0">
            <CardHeader>
              <CardTitle className="text-sm">Dev bypass</CardTitle>
              <p className="text-xs text-muted-foreground">
                Skips LINE login only — signs in as a real seeded backend user, not
                shown in production builds.
              </p>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2">
                {devRoles.map(({ role, label }) => (
                  <Button
                    key={role}
                    variant="outline"
                    size="sm"
                    disabled={pendingRole !== null}
                    onClick={() => {
                      setDevError(null);
                      setPendingRole(role);
                      startDevSession(role)
                        .then(() => router.push("/"))
                        .catch((err: Error) => {
                          setDevError(err.message);
                          setPendingRole(null);
                        });
                    }}
                  >
                    {label}
                  </Button>
                ))}
              </div>
              {devError && (
                <p className="text-xs text-danger-foreground">{devError}</p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}

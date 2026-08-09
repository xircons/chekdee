"use client";

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

  return (
    <main className="flex min-h-full flex-1 items-center justify-center p-6">
      <div className="flex w-full max-w-sm flex-col gap-4">
        <Card className="rounded-2xl shadow-md">
          <CardHeader>
            <CardTitle className="text-center text-xl">Checkdee</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-center text-sm text-muted-foreground">
              Sign in with your LINE account to check in and out.
            </p>
            <Button
              className="w-full bg-[#06C755] text-white hover:bg-[#05b34c]"
              onClick={() => {
                window.location.href = buildLineLoginURL();
              }}
            >
              Login with LINE
            </Button>
          </CardContent>
        </Card>

        {devBypassAvailable && (
          <Card className="rounded-2xl border-dashed shadow-none">
            <CardHeader>
              <CardTitle className="text-sm">Dev bypass</CardTitle>
              <p className="text-xs text-muted-foreground">
                Skips LINE/backend auth — mock session only, not shown in production
                builds.
              </p>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              {devRoles.map(({ role, label }) => (
                <Button
                  key={role}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    startDevSession(role);
                    router.push("/");
                  }}
                >
                  {label}
                </Button>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}

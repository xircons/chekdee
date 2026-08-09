"use client";

import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { mockEmployees, mockTeam } from "@/lib/mock-data";
import { useMe, logout } from "@/lib/session";

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
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-6">
      <h1 className="text-2xl font-bold text-foreground">Profile</h1>

      <Card className="rounded-2xl shadow-sm">
        <CardContent className="flex items-center gap-4 p-4">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-semibold text-primary-foreground">
            {initials(me.first_name, me.last_name, me.display_name)}
          </div>
          <div>
            <p className="text-lg font-semibold text-foreground">{fullName}</p>
            <Badge variant="secondary" className="mt-1 capitalize">
              {me.role.replace("_", " ")}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {mockProfile && (
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Team</span>
              <span className="text-foreground">{mockTeam.name}</span>
            </div>
            {mockProfile.studentGen && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Student gen</span>
                <span className="text-foreground">{mockProfile.studentGen}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Button
        variant="outline"
        onClick={() => {
          void logout().then(() => router.push("/login"));
        }}
      >
        Log out
      </Button>
    </main>
  );
}

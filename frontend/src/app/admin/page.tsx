"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMe } from "@/lib/session";

export default function AdminDashboard() {
  const me = useMe();

  return (
    <main className="flex flex-1 flex-col gap-6 p-6">
      <h1 className="text-2xl font-bold text-foreground">
        Welcome, {me.first_name ?? me.display_name}
      </h1>
      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle>Coming soon</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            The present-today / pending-approvals / absences / leave-requests summary
            cards land in Phase 3 — see PLAN.md.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

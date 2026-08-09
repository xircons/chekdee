import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LeaveRequestsPage() {
  return (
    <main className="flex flex-1 flex-col gap-6 p-6">
      <h1 className="text-2xl font-bold text-foreground">Leave requests</h1>
      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle>Coming soon</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            The approval list (the in-app fallback to the email-approval flow) lands in
            Phase 3 — see PLAN.md.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

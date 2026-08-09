import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LeavePage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-6">
      <h1 className="text-2xl font-bold text-foreground">Leave</h1>
      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle>Coming soon</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            The leave request form and request history land in Phase 2 — see PLAN.md.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

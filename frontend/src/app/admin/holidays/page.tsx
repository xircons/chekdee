import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function HolidaysPage() {
  return (
    <main className="flex flex-1 flex-col gap-6 p-6">
      <h1 className="text-2xl font-bold text-foreground">Holidays</h1>
      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle>Coming soon</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Manually adding, editing, and removing holidays lands in Phase 3 — see
            PLAN.md.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

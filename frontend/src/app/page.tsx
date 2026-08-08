import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const stats = [
  { label: "Hours this month", value: "128" },
  { label: "Late (สาย)", value: "2" },
  { label: "Absent (ขาด)", value: "0" },
  { label: "Leave balance", value: "6" },
];

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Checkdee</h1>
        <p className="text-sm text-muted-foreground">
          Employee attendance for CAMT, Chiang Mai University
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="rounded-2xl shadow-sm">
            <CardContent className="p-4">
              <p className="text-3xl font-bold tabular-nums">{stat.value}</p>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {stat.label}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle>Status badges</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Badge variant="success">Present</Badge>
          <Badge variant="warning">สาย</Badge>
          <Badge variant="danger">ขาด</Badge>
          <Badge variant="status-secondary">On leave</Badge>
        </CardContent>
      </Card>
    </main>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { MapPin } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTodayAttendance } from "@/lib/attendance-store";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function CheckInPage() {
  const router = useRouter();
  const { today, checkIn, checkOut } = useTodayAttendance();

  const handleCheckIn = () => {
    checkIn();
    router.push("/");
  };

  const handleCheckOut = () => {
    checkOut();
    router.push("/");
  };

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-6">
      <h1 className="text-2xl font-bold text-foreground">Check in / out</h1>

      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="size-4" />
            Location and Wi-Fi verification
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Geofence/Wi-Fi verification runs automatically when the backend is wired up
            — this screen is UI only for now.
          </p>
        </CardContent>
      </Card>

      {!today.checkInAt && (
        <Card className="rounded-2xl shadow-sm">
          <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
            <p className="text-sm text-muted-foreground">You haven&apos;t checked in today.</p>
            <Button size="lg" className="w-full" onClick={handleCheckIn}>
              Check In Now
            </Button>
          </CardContent>
        </Card>
      )}

      {today.checkInAt && !today.checkOutAt && (
        <Card className="rounded-2xl shadow-sm">
          <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
            <p className="text-sm text-muted-foreground">
              Checked in at {formatTime(today.checkInAt)}
            </p>
            <Button size="lg" className="w-full" onClick={handleCheckOut}>
              Check Out Now
            </Button>
          </CardContent>
        </Card>
      )}

      {today.checkInAt && today.checkOutAt && (
        <Card className="rounded-2xl shadow-sm">
          <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
            <p className="text-sm font-medium text-foreground">You&apos;re all done for today.</p>
            <p className="text-sm text-muted-foreground">
              {formatTime(today.checkInAt)} – {formatTime(today.checkOutAt)}
            </p>
          </CardContent>
        </Card>
      )}
    </main>
  );
}

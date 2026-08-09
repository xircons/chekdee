"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMe, logout } from "@/lib/session";

export default function ProfilePage() {
  const me = useMe();
  const router = useRouter();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-6">
      <h1 className="text-2xl font-bold text-foreground">Profile</h1>
      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle>{me.first_name ?? me.display_name}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 text-sm text-muted-foreground">
          <p>{me.last_name}</p>
          <p className="capitalize">{me.role}</p>
        </CardContent>
      </Card>
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

"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildLineLoginURL } from "@/lib/line";

export default function LoginPage() {
  return (
    <main className="flex min-h-full flex-1 items-center justify-center p-6">
      <Card className="w-full max-w-sm rounded-2xl shadow-md">
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
    </main>
  );
}

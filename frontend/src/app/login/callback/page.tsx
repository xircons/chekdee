"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { apiFetch } from "@/lib/api";
import { setAccessToken } from "@/lib/auth";
import { consumeStoredState, lineLoginRedirectURI } from "@/lib/line";

type LoginResponse = {
  access_token: string;
  user: { is_registered: boolean };
};

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const lineError = searchParams.get("error");

    if (lineError) {
      setError("การเข้าสู่ระบบด้วย LINE ถูกยกเลิกหรือถูกปฏิเสธ");
      return;
    }

    if (!code || !state || state !== consumeStoredState()) {
      setError("เซสชันการเข้าสู่ระบบไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง");
      return;
    }

    (async () => {
      const res = await apiFetch("/auth/line/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, redirect_uri: lineLoginRedirectURI() }),
      });

      if (!res.ok) {
        setError("เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
        return;
      }

      const data = (await res.json()) as LoginResponse;
      setAccessToken(data.access_token);
      router.replace(data.user.is_registered ? "/" : "/register");
    })();
  }, [router, searchParams]);

  if (error) {
    return (
      <p className="text-center text-sm text-danger-foreground">{error}</p>
    );
  }

  return <p className="text-center text-sm text-muted-foreground">กำลังเข้าสู่ระบบ...</p>;
}

export default function LoginCallbackPage() {
  return (
    <main className="flex min-h-full flex-1 items-center justify-center p-6">
      <Suspense fallback={<p className="text-sm text-muted-foreground">กำลังเข้าสู่ระบบ...</p>}>
        <CallbackHandler />
      </Suspense>
    </main>
  );
}

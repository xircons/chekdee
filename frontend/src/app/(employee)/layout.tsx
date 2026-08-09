"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { EmployeeNav } from "@/components/employee-nav";
import { MeContext, useSession } from "@/lib/session";

export default function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { me, loading } = useSession();

  useEffect(() => {
    if (me && me.role !== "employee") {
      router.replace("/admin");
    }
  }, [me, router]);

  if (loading || !me || me.role !== "employee") {
    return (
      <main className="flex min-h-full flex-1 items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </main>
    );
  }

  return (
    <MeContext.Provider value={me}>
      <div className="mx-auto flex min-h-full w-full max-w-3xl flex-1 flex-col">
        <div className="flex-1">{children}</div>
        <EmployeeNav />
      </div>
    </MeContext.Provider>
  );
}

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { AdminSidebar } from "@/components/admin-sidebar";
import { MeContext, useSession } from "@/lib/session";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { me, loading } = useSession();

  useEffect(() => {
    if (me && me.role === "employee") {
      router.replace("/");
    }
  }, [me, router]);

  if (loading || !me || me.role === "employee") {
    return (
      <main className="flex min-h-full flex-1 items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </main>
    );
  }

  return (
    <MeContext.Provider value={me}>
      <div className="flex min-h-full flex-1">
        <AdminSidebar />
        <div className="flex-1 overflow-x-auto">{children}</div>
      </div>
    </MeContext.Provider>
  );
}

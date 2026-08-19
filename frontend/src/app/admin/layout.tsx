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
      {/* Pinned to exactly one viewport tall so the page itself never scrolls
          — `flex-none` matters here, same flexbox quirk as the employee shell:
          `flex-1`'s `flex-basis:0%` would otherwise pre-empt `h-screen`. Only
          the content column scrolls internally, with its scrollbar hidden. */}
      <div className="flex h-screen flex-none overflow-hidden">
        <AdminSidebar />
        <div className="min-h-0 flex-1 overflow-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {children}
        </div>
      </div>
    </MeContext.Provider>
  );
}

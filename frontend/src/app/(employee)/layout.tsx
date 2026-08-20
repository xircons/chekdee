"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { EmployeeNav } from "@/components/employee-nav";
import { AttendanceProvider } from "@/lib/attendance-store";
import { MeContext, useSession } from "@/lib/session";

// Full-screen routes (camera, etc.) opt out of the tab bar chrome.
const FULL_SCREEN_ROUTES = ["/check-in/scan", "/check-in/confirm"];

export default function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { me, loading } = useSession();
  const isFullScreen = FULL_SCREEN_ROUTES.includes(pathname);

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
      <AttendanceProvider>
        {isFullScreen ? (
          children
        ) : (
          // Below `md` this is a single unstyled flex column, unchanged —
          // the whole page scrolls normally, as it always has.
          // At `md` and up it becomes two nested boxes: an outer one
          // pinned to exactly one viewport tall (`md:h-screen`, so the
          // page itself never scrolls) painted with a neutral backdrop;
          // and the original div, now width-`auto` with a 9:19.5 aspect
          // ratio (its height already fills the outer box, so the ratio
          // derives a phone-proportioned width from that height), framed
          // as a card, and scrolling its own content internally
          // (`md:overflow-y-auto`, scrollbar hidden but still scrollable)
          // once that content is taller than the card — the sticky nav
          // stays pinned to the card's bottom edge through that inner
          // scroll, same as it sticks to the page's bottom edge on mobile.
          <div className="flex min-h-full w-full flex-1 flex-col md:h-screen md:min-h-0 md:flex-none md:bg-muted md:py-8">
            <div className="mx-auto flex min-h-full w-full max-w-3xl flex-1 flex-col md:w-auto md:min-h-0 md:aspect-[9/19.5] md:max-w-none md:overflow-x-hidden md:overflow-y-auto md:rounded-3xl md:bg-background md:shadow-xl md:ring-1 md:ring-foreground/10 md:[scrollbar-width:none] md:[&::-webkit-scrollbar]:hidden">
              <div className="flex-1">{children}</div>
              <EmployeeNav />
            </div>
          </div>
        )}
      </AttendanceProvider>
    </MeContext.Provider>
  );
}

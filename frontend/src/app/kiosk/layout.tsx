// The kiosk sits outside both the employee tab-nav shell and the admin
// sidebar shell (see admin/layout.tsx) — it authenticates via a device
// token in the URL, not a login session, so there's no useSession()/MeContext
// gate here and no nav chrome. Bare full-screen, meant for an unattended TV.
export default function KioskLayout({ children }: { children: React.ReactNode }) {
  return <div className="flex h-screen flex-none overflow-hidden bg-slate-950">{children}</div>;
}

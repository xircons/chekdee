// Desktop counterpart to EmployeePageHeader — a rounded bg-brand-600
// banner behind the page title, fully rounded (not edge-to-edge like the
// mobile header) since it sits inside the admin content area next to the
// sidebar.
export function AdminPageHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <header className="rounded-2xl bg-brand-600 px-6 py-6 text-white">
      <h1 className="text-2xl font-bold">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-white/80">{subtitle}</p>}
    </header>
  );
}

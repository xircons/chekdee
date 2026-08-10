export function EmployeePageHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <header className="rounded-b-3xl bg-brand-600 px-6 pt-6 pb-10 text-white">
      <h1 className="text-2xl font-bold">{title}</h1>
      {subtitle && <p className="mt-2 text-sm text-white/80">{subtitle}</p>}
    </header>
  );
}

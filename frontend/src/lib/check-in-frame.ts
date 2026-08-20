// Shared with every full-screen check-in route (bypasses the employee shell
// entirely, see FULL_SCREEN_ROUTES in (employee)/layout.tsx) — same
// outer/inner recipe as the shell's own framing, just wrapped in
// `fixed inset-0` instead of sitting in normal document flow. Width is
// derived from height via aspect-[9/19.5], not a fixed pixel width, so the
// ratio holds at any viewport height and matches every other page exactly.
export const DESKTOP_OUTER_FRAME =
  "fixed inset-0 z-50 flex min-h-full w-full flex-1 flex-col md:h-screen md:min-h-0 md:flex-none md:bg-muted md:py-8";
export const DESKTOP_INNER_FRAME =
  "mx-auto flex min-h-full w-full flex-1 flex-col md:w-auto md:min-h-0 md:aspect-[9/19.5] md:max-w-none md:overflow-hidden md:rounded-3xl md:shadow-xl md:ring-1 md:ring-foreground/10";

// Matches the employee shell's actual field style — soft muted fill, no
// stark border. The employee side's own fields use rounded-xl (20px) at
// h-12; at this row's shorter h-9 the same 20px radius is large enough
// relative to the box that CSS caps/scales the corners down to a full
// stadium pill (a real rendering effect, not just a class-name mismatch)
// — rounded-lg (16px) keeps the same proportion without hitting that cap.
export const FIELD_CLASS =
  "h-9 rounded-lg border-border bg-muted/40 px-4 text-sm focus-visible:border-brand-600 focus-visible:bg-card focus-visible:ring-brand-600/20";
export const ACTION_BUTTON_CLASS = "h-9 rounded-lg px-5 text-sm focus-visible:ring-brand-600/20";

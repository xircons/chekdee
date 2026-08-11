"use client";

import { packCirclesInCircle } from "@/lib/circle-pack";
import { cn } from "@/lib/utils";

export type BubbleEntry = {
  id: string;
  initials: string;
  pictureUrl: string | null;
  status: "checked-in" | "late";
};

const CONTAINER_DIAMETER = 260;
const CONTAINER_RADIUS = CONTAINER_DIAMETER / 2;
const INNER_PADDING = 12;
// Shrinks the packed radius slightly so adjacent bubbles keep a visible gap
// instead of touching edge-to-edge.
const BUBBLE_GAP_SCALE = 0.86;

export function AdminBubbleChart({ entries }: { entries: BubbleEntry[] }) {
  const { radius, positions } = packCirclesInCircle(entries.length, CONTAINER_RADIUS - INNER_PADDING);
  const bubbleRadius = radius * BUBBLE_GAP_SCALE;
  const bubbleDiameter = bubbleRadius * 2;
  const fontSize = Math.max(8, Math.min(13, bubbleRadius * 0.62));

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4">
      <div
        className="relative shrink-0 rounded-full border border-brand-600/15 bg-brand-100/70"
        style={{ width: CONTAINER_DIAMETER, height: CONTAINER_DIAMETER }}
      >
        {entries.map((entry, i) => {
          const pos = positions[i];
          if (!pos) return null;
          return (
            <div
              key={entry.id}
              className={cn(
                "animate-bubble-pop absolute flex items-center justify-center rounded-full font-semibold text-white transition-colors duration-300",
                entry.status === "checked-in" ? "bg-success-foreground" : "bg-accent-600",
                entry.pictureUrl &&
                  (entry.status === "checked-in"
                    ? "ring-4 ring-success-foreground"
                    : "ring-4 ring-accent-600")
              )}
              style={{
                width: bubbleDiameter,
                height: bubbleDiameter,
                left: CONTAINER_RADIUS + pos.x - bubbleRadius,
                top: CONTAINER_RADIUS + pos.y - bubbleRadius,
                fontSize,
              }}
            >
              {entry.pictureUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- user-supplied LINE avatar URL, not a static asset
                <img src={entry.pictureUrl} alt="" className="size-full rounded-full object-cover" />
              ) : (
                entry.initials
              )}
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-success-foreground" />
          เช็คอินแล้ว
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-accent-600" />
          เลยเวลา
        </span>
      </div>
    </div>
  );
}

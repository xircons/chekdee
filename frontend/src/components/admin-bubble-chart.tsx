"use client";

import { useState } from "react";

import { findBubblePosition, packCirclesInCircle, type PackedCircle } from "@/lib/circle-pack";
import { cn } from "@/lib/utils";

export type BubbleEntry = {
  id: string;
  initials: string;
  pictureUrl: string | null;
  status: "checked-in" | "late";
};

const CONTAINER_DIAMETER = 420;
const CONTAINER_RADIUS = CONTAINER_DIAMETER / 2;
const INNER_PADDING = 20;
// Shrinks the packed radius slightly so adjacent bubbles keep a visible gap
// instead of touching edge-to-edge.
const BUBBLE_GAP_SCALE = 0.86;

function shuffle<T>(list: T[]): T[] {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

export function AdminBubbleChart({ entries }: { entries: BubbleEntry[] }) {
  const packRadius = CONTAINER_RADIUS - INNER_PADDING;
  const { radius, positions: ringPositions } = packCirclesInCircle(entries.length, packRadius);
  const bubbleRadius = radius * BUBBLE_GAP_SCALE;
  const bubbleDiameter = bubbleRadius * 2;
  const fontSize = Math.max(8, Math.min(13, bubbleRadius * 0.62));

  // Positions are assigned once per bubble (id) and kept stable across
  // re-renders — only newly-appearing ids get a freshly randomized spot —
  // so existing bubbles don't jump around every time the roster re-ticks.
  // Adjusted directly during render (React's documented pattern for
  // deriving state from a changed prop) rather than in an effect, so it
  // doesn't cost an extra commit every time entries changes.
  const [positions, setPositions] = useState<Map<string, PackedCircle>>(new Map());
  const [knownIdsKey, setKnownIdsKey] = useState("");

  const activeIds = entries.map((e) => e.id);
  const idsKey = activeIds.slice().sort().join(",");

  if (idsKey !== knownIdsKey) {
    const activeSet = new Set(activeIds);
    const kept = new Map<string, PackedCircle>();
    positions.forEach((pos, id) => {
      if (activeSet.has(id)) kept.set(id, pos);
    });

    const usableRadius = packRadius - bubbleRadius;
    let needsRepack = false;
    for (const id of shuffle(activeIds.filter((existingId) => !kept.has(existingId)))) {
      const pos = findBubblePosition(Array.from(kept.values()), bubbleRadius, usableRadius);
      if (!pos) {
        // The fixed existing positions leave no room for one more circle —
        // reflow everyone at once using the proven-correct ring layout
        // instead of leaving a bubble unplaced or overlapping.
        needsRepack = true;
        break;
      }
      kept.set(id, pos);
    }

    const finalPositions = needsRepack
      ? new Map(shuffle(activeIds.slice()).map((id, i) => [id, ringPositions[i]]))
      : kept;

    setPositions(finalPositions);
    setKnownIdsKey(idsKey);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4">
      <div
        className="relative shrink-0 rounded-full border border-brand-600/15 bg-brand-100/70"
        style={{ width: CONTAINER_DIAMETER, height: CONTAINER_DIAMETER }}
      >
        {entries.map((entry) => {
          const pos = positions.get(entry.id);
          if (!pos) return null;
          return (
            <div
              key={entry.id}
              className={cn(
                "animate-bubble-pop absolute flex items-center justify-center rounded-full font-semibold text-white transition-all duration-[350ms] ease-out",
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

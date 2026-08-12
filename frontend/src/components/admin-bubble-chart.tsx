"use client";

import { useState } from "react";

import {
  assignRankedShellPositions,
  findBubblePosition,
  packCirclesInCircle,
  type PackedCircle,
} from "@/lib/circle-pack";
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
// Faint reference circles hinting at the center-to-edge growth structure.
const GUIDE_RING_FRACTIONS = [0.25, 0.5, 0.75];
const BUBBLE_POP_ANIMATION = "bubble-pop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both";

function shuffle<T>(list: T[]): T[] {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

// Deterministic per-id fraction so each bubble's idle bob has a stable
// (but different) timing/phase instead of every bubble moving in lockstep.
function hashUnit(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return (Math.abs(h) % 1000) / 1000;
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
  const [mostRecentId, setMostRecentId] = useState<string | null>(null);

  const activeIds = entries.map((e) => e.id);
  const idsKey = activeIds.slice().sort().join(",");

  if (idsKey !== knownIdsKey) {
    const activeSet = new Set(activeIds);
    // Insertion order of the Map (preserved by JS) is the arrival order —
    // oldest survivors first — which is exactly the center-to-edge rank.
    const kept = new Map<string, PackedCircle>();
    const survivorRank: string[] = [];
    positions.forEach((pos, id) => {
      if (activeSet.has(id)) {
        kept.set(id, pos);
        survivorRank.push(id);
      }
    });

    const newIds = shuffle(activeIds.filter((id) => !kept.has(id)));
    const rankedIds = [...survivorRank, ...newIds];
    const totalCount = rankedIds.length;
    const usableRadius = packRadius - bubbleRadius;

    let needsRepack = false;
    for (let i = 0; i < newIds.length; i++) {
      const rank = survivorRank.length + i;
      // 0 = center (oldest), 1 = outer edge (newest).
      const targetFraction = totalCount > 1 ? rank / (totalCount - 1) : 0;
      const pos = findBubblePosition(Array.from(kept.values()), bubbleRadius, usableRadius, targetFraction);
      if (!pos) {
        // The fixed existing positions leave no room for one more circle —
        // reflow everyone at once, still oldest-innermost, using the
        // proven-correct ring layout instead of leaving a bubble unplaced.
        needsRepack = true;
        break;
      }
      kept.set(newIds[i], pos);
    }

    const finalPositions = needsRepack
      ? assignRankedShellPositions(rankedIds, ringPositions, shuffle)
      : kept;

    setPositions(finalPositions);
    setKnownIdsKey(idsKey);
    if (newIds.length > 0) setMostRecentId(rankedIds[rankedIds.length - 1]);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4">
      <div
        className="relative shrink-0 rounded-full border border-brand-600/15 bg-brand-100/70"
        style={{ width: CONTAINER_DIAMETER, height: CONTAINER_DIAMETER }}
      >
        {GUIDE_RING_FRACTIONS.map((fraction) => {
          const diameter = fraction * packRadius * 2;
          return (
            <div
              key={fraction}
              className="pointer-events-none absolute rounded-full border border-brand-600/10"
              style={{
                width: diameter,
                height: diameter,
                left: CONTAINER_RADIUS - diameter / 2,
                top: CONTAINER_RADIUS - diameter / 2,
              }}
            />
          );
        })}
        {entries.map((entry) => {
          const pos = positions.get(entry.id);
          if (!pos) return null;

          const isNewest = entry.id === mostRecentId;
          const bobDuration = 4 + hashUnit(entry.id + "dur") * 2;
          const bobDelay = -(hashUnit(entry.id + "delay") * bobDuration);
          const animation = [
            BUBBLE_POP_ANIMATION,
            `bubble-bob ${bobDuration}s ease-in-out ${bobDelay}s infinite`,
            isNewest && "bubble-highlight 1.2s ease-in-out infinite",
          ]
            .filter(Boolean)
            .join(", ");

          return (
            <div
              key={entry.id}
              className={cn(
                "absolute flex items-center justify-center rounded-full font-semibold text-white transition-[width,height,left,top,background-color] duration-[350ms] ease-out",
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
                animation,
                outlineStyle: isNewest ? "solid" : undefined,
                outlineOffset: isNewest ? 2 : undefined,
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

// Equal-circle packing inside a fixed outer circle (concentric rings, center
// circle first). Used by the admin dashboard's bubble-pack visualization,
// where every bubble is the same size and that size should shrink as
// headcount grows to keep everyone inside the fixed-size container.
export type PackedCircle = { x: number; y: number };

export type CirclePackResult = {
  radius: number;
  positions: PackedCircle[];
};

function ringCapacity(bubbleRadius: number, ringDistance: number): number {
  if (ringDistance <= 0) return 1;
  const angularSlot = 2 * Math.asin(Math.min(1, bubbleRadius / ringDistance));
  if (angularSlot <= 0) return 1;
  return Math.max(1, Math.floor((2 * Math.PI) / angularSlot));
}

function totalCapacity(bubbleRadius: number, containerRadius: number): number {
  let total = 1; // center bubble
  let ring = 1;
  while (true) {
    const ringDistance = 2 * bubbleRadius * ring;
    if (ringDistance + bubbleRadius > containerRadius) break;
    total += ringCapacity(bubbleRadius, ringDistance);
    ring++;
  }
  return total;
}

export function packCirclesInCircle(count: number, containerRadius: number): CirclePackResult {
  if (count <= 0 || containerRadius <= 0) return { radius: 0, positions: [] };
  if (count === 1) return { radius: containerRadius * 0.9, positions: [{ x: 0, y: 0 }] };

  // Binary search the largest bubble radius for which `count` bubbles still
  // fit in concentric rings (each ring spaced 2r apart) without spilling
  // past the container edge.
  let lo = containerRadius / 1000;
  let hi = containerRadius;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (totalCapacity(mid, containerRadius) >= count) lo = mid;
    else hi = mid;
  }
  const radius = lo;

  const positions: PackedCircle[] = [{ x: 0, y: 0 }];
  let ring = 1;
  while (positions.length < count) {
    const ringDistance = 2 * radius * ring;
    if (ringDistance + radius > containerRadius) break;
    const capacity = ringCapacity(radius, ringDistance);
    const slots = Math.min(capacity, count - positions.length);
    for (let i = 0; i < slots; i++) {
      const angle = (i / capacity) * 2 * Math.PI;
      positions.push({ x: ringDistance * Math.cos(angle), y: ringDistance * Math.sin(angle) });
    }
    ring++;
  }

  return { radius, positions };
}

// Finds a random non-overlapping spot for one more circle of `bubbleRadius`
// among `existing` circles of the same radius, inside a disk of
// `usableRadius` (i.e. containerRadius - bubbleRadius, so the new circle's
// edge stays inside the container). Falls back to a fine spiral scan if
// random sampling can't find a free spot at high density. Returns null if
// neither finds room — that means the existing (fixed) circles are
// arranged in a way that can't fit one more without moving any of them,
// which callers should handle by repacking everyone.
export function findBubblePosition(
  existing: PackedCircle[],
  bubbleRadius: number,
  usableRadius: number
): PackedCircle | null {
  const minDistance = bubbleRadius * 2;
  const fits = (candidate: PackedCircle) =>
    existing.every((p) => Math.hypot(p.x - candidate.x, p.y - candidate.y) >= minDistance);

  for (let attempt = 0; attempt < 400; attempt++) {
    const angle = Math.random() * 2 * Math.PI;
    // sqrt(random) samples uniformly over the disk's area, not just its radius.
    const distance = Math.sqrt(Math.random()) * usableRadius;
    const candidate = { x: distance * Math.cos(angle), y: distance * Math.sin(angle) };
    if (fits(candidate)) return candidate;
  }

  const step = Math.max(bubbleRadius * 0.4, 1);
  for (let r = 0; r <= usableRadius; r += step) {
    const angleStep = Math.max(step / Math.max(r, step), Math.PI / 90);
    for (let angle = 0; angle < 2 * Math.PI; angle += angleStep) {
      const candidate = { x: r * Math.cos(angle), y: r * Math.sin(angle) };
      if (fits(candidate)) return candidate;
    }
  }

  return null;
}

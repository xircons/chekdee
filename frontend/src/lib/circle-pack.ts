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

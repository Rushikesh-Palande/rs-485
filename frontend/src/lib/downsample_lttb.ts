export type XY = { x: number; y: number };

/**
 * Largest-Triangle-Three-Buckets (LTTB) downsampling.
 *
 * Why:
 * - For realtime charts, rendering 50k+ points per series kills FPS.
 * - LTTB keeps the *shape* while reducing to a stable budget (e.g. 2k).
 *
 * This is a major win for high-frequency telemetry.
 */
export function lttb(data: XY[], threshold: number): XY[] {
  if (threshold >= data.length || threshold <= 2) return data.slice();

  const sampled: XY[] = [];
  const bucketSize = (data.length - 2) / (threshold - 2);

  sampled.push(data[0]);

  let a = 0;
  for (let i = 0; i < threshold - 2; i++) {
    const rangeStart = Math.floor(i * bucketSize) + 1;
    const rangeEnd = Math.floor((i + 1) * bucketSize) + 1;

    const nextStart = Math.floor((i + 1) * bucketSize) + 1;
    const nextEnd = Math.floor((i + 2) * bucketSize) + 1;

    // average of next bucket
    let avgX = 0;
    let avgY = 0;
    const avgLen = Math.max(1, nextEnd - nextStart);
    for (let j = nextStart; j < nextEnd && j < data.length; j++) {
      avgX += data[j].x;
      avgY += data[j].y;
    }
    avgX /= avgLen;
    avgY /= avgLen;

    let maxArea = -1;
    let maxPoint = data[rangeStart];
    const pointA = data[a];

    for (let j = rangeStart; j < rangeEnd && j < data.length; j++) {
      const area =
        Math.abs(
          (pointA.x - avgX) * (data[j].y - pointA.y) -
            (pointA.x - data[j].x) * (avgY - pointA.y)
        ) * 0.5;

      if (area > maxArea) {
        maxArea = area;
        maxPoint = data[j];
        a = j;
      }
    }

    sampled.push(maxPoint);
  }

  sampled.push(data[data.length - 1]);
  return sampled;
}

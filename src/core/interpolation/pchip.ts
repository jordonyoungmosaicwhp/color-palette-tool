export function computePchipDerivatives(points: Array<{ x: number; y: number }>): number[] {
  const n = points.length;
  if (n === 0) return [];
  if (n === 1) return [0];
  if (n === 2) {
    const slope = (points[1].y - points[0].y) / (points[1].x - points[0].x);
    return [slope, slope];
  }

  const h: number[] = [];
  const delta: number[] = [];

  for (let i = 0; i < n - 1; i++) {
    const spacing = points[i + 1].x - points[i].x;
    h.push(spacing);
    delta.push((points[i + 1].y - points[i].y) / spacing);
  }

  const derivatives = new Array<number>(n).fill(0);
  derivatives[0] = endpointDerivative(h[0], h[1], delta[0], delta[1]);
  derivatives[n - 1] = endpointDerivative(h[n - 2], h[n - 3] ?? h[n - 2], delta[n - 2], delta[n - 3] ?? delta[n - 2]);

  for (let i = 1; i < n - 1; i++) {
    const prev = delta[i - 1];
    const next = delta[i];
    if (prev === 0 || next === 0 || Math.sign(prev) !== Math.sign(next)) {
      derivatives[i] = 0;
      continue;
    }

    const w1 = 2 * h[i] + h[i - 1];
    const w2 = h[i] + 2 * h[i - 1];
    derivatives[i] = (w1 + w2) / (w1 / prev + w2 / next);
  }

  return derivatives;
}

export function endpointDerivative(h0: number, h1: number, d0: number, d1: number): number {
  const derivative = ((2 * h0 + h1) * d0 - h0 * d1) / (h0 + h1);
  if (Math.sign(derivative) !== Math.sign(d0)) return 0;
  if (Math.sign(d0) !== Math.sign(d1) && Math.abs(derivative) > Math.abs(3 * d0)) return 3 * d0;
  return derivative;
}

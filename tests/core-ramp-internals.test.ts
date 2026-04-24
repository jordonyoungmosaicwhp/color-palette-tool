import { describe, expect, it } from 'vitest';

import { createDefaultConfig } from '../src/lib/color';
import { dedupeCustomStops, prepareCustomStops } from '../src/core/ramp/customStops';
import { buildHueInterpolationPoints } from '../src/core/ramp/interpolationPoints';
import { findInterpolationSegment, shapeForSegment, touchesEndpoint } from '../src/core/ramp/segmentRouting';
import { sampleChannelInterpolation } from '../src/core/ramp/segmentedInterpolation';

describe('core ramp internals', () => {
  it('prepares custom stops by preserving valid stops and dropping invalid ones from the prepared set', () => {
    const config = createDefaultConfig();
    const ramp = {
      ...config.ramp,
      customStops: [
        { id: 'invalid', color: '' },
        { id: 'first', color: 'oklch(0.8 0.08 30)' },
        { id: 'duplicate-index', color: 'oklch(0.8 0.05 150)' },
        { id: 'second', color: 'oklch(0.6 0.08 60)' },
      ],
    };

    expect(dedupeCustomStops(ramp.customStops ?? [], config.theme)).toHaveLength(3);

    const prepared = prepareCustomStops(config.theme, ramp);

    expect(prepared.customStops.map((stop) => stop.id)).toEqual(['duplicate-index', 'second']);
    expect([...prepared.customStopIndices]).toHaveLength(2);
  });

  it('orders interpolation points by position and kind precedence', () => {
    const config = createDefaultConfig();
    const ramp = {
      ...config.ramp,
      customStopsMidpointLocked: false,
      huePreset: {
        ...config.ramp.huePreset!,
        centerPosition: 0.5,
        center: 210,
      },
      customStops: [
        { id: 'same-position', color: 'oklch(0.6 0.08 30)' },
      ],
    };

    const points = buildHueInterpolationPoints(config.theme, ramp, ramp.customStops ?? []);

    expect(points.map((point) => point.kind)).toEqual(['start', 'custom', 'midpoint', 'end']);
  });

  it('routes endpoint and interior segments correctly', () => {
    const points = [
      { kind: 'start' as const, position: 0, value: 0 },
      { kind: 'custom' as const, position: 300, value: 30 },
      { kind: 'custom' as const, position: 700, value: 70 },
      { kind: 'end' as const, position: 1000, value: 100 },
    ];
    const config = createDefaultConfig();

    const startSegment = findInterpolationSegment(points, 100);
    const middleSegment = findInterpolationSegment(points, 500);
    const endSegment = findInterpolationSegment(points, 900);

    expect(startSegment?.left.kind).toBe('start');
    expect(middleSegment?.left.kind).toBe('custom');
    expect(middleSegment?.right.kind).toBe('custom');
    expect(endSegment?.right.kind).toBe('end');
    expect(touchesEndpoint(startSegment?.left.kind ?? 'custom', startSegment?.right.kind ?? 'custom')).toBe(true);
    expect(touchesEndpoint(middleSegment?.left.kind ?? 'custom', middleSegment?.right.kind ?? 'custom')).toBe(false);
    expect(shapeForSegment(config.ramp, 'hue', 'start', 'custom')).toBe(config.ramp.huePreset?.startShape ?? 0);
    expect(shapeForSegment(config.ramp, 'chroma', 'custom', 'end')).toBe(config.ramp.chromaPreset.endShape);
  });

  it('keeps segmented hue interpolation normalized across wraparound', () => {
    const config = createDefaultConfig();
    const points = [
      { kind: 'start' as const, position: 0, value: 350 },
      { kind: 'custom' as const, position: 500, value: 10 },
      { kind: 'end' as const, position: 1000, value: 30 },
    ];
    const ramp = {
      ...config.ramp,
      huePreset: {
        ...config.ramp.huePreset!,
        start: 350,
        center: 10,
        end: 30,
        startDirection: 'clockwise' as const,
        endDirection: 'clockwise' as const,
      },
    };

    const sample = sampleChannelInterpolation(points, 250, ramp, 'hue');

    expect(sample).toBeDefined();
    expect(sample!).toBeGreaterThanOrEqual(0);
    expect(sample!).toBeLessThan(360);
    expect(sample!).toBeCloseTo(0, 0);
  });
});

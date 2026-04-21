import { describe, expect, it } from 'vitest';
import {
  addStop,
  anchorHueIsOnPath,
  createDefaultConfig,
  createExportBundle,
  deleteStop,
  generateRamp,
  chromaForProgress,
  hueForStop,
  insertStopBetween,
  setAnchor,
  shapedProgress,
  validateGeneratedStops,
} from '../src/lib/color';

describe('OKLCH ramp engine', () => {
  it('generates canonical stops from lightness endpoints', () => {
    const config = createDefaultConfig();
    const stops = generateRamp(config.theme, config.ramp);

    expect(config.theme.lMax).toBe(1);
    expect(stops.map((stop) => stop.index)).toEqual([0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]);
    expect(stops[0].oklch.l).toBeCloseTo(config.theme.lMax);
    expect(stops.at(-1)?.oklch.l).toBeCloseTo(config.theme.lMin);
  });

  it('inserts 50 and 25 stops hierarchically', () => {
    const config = createDefaultConfig();
    const with50 = insertStopBetween(config.ramp.stops, 100, 200);
    const with25 = insertStopBetween(with50, 100, 150);

    expect(with50.some((stop) => stop.index === 150 && stop.resolution === 50)).toBe(true);
    expect(with25.some((stop) => stop.index === 125 && stop.resolution === 25)).toBe(true);
  });

  it('prevents subdivision beyond 25', () => {
    const config = createDefaultConfig();
    const with50 = insertStopBetween(config.ramp.stops, 100, 200);
    const with25 = insertStopBetween(with50, 100, 150);
    const unchanged = insertStopBetween(with25, 100, 125);

    expect(unchanged.map((stop) => stop.index)).toEqual(with25.map((stop) => stop.index));
  });

  it('deletes intermediate stops and dependent 25 children', () => {
    const config = createDefaultConfig();
    const withChildren = addStop(addStop(config.ramp.stops, 150), 125);
    const deleted = deleteStop(withChildren, 150);

    expect(deleted.some((stop) => stop.index === 150)).toBe(false);
    expect(deleted.some((stop) => stop.index === 125)).toBe(false);
    expect(deleted.some((stop) => stop.index === 100)).toBe(true);
  });

  it('snaps anchors to configured resolution and preserves exact anchor OKLCH', () => {
    const config = createDefaultConfig();
    const ramp = setAnchor(config.ramp, '#dc2626', 462, 50);
    const stops = generateRamp(config.theme, ramp);
    const anchorStop = stops.find((stop) => stop.index === 450);

    expect(ramp.anchor?.stop).toBe(450);
    expect(anchorStop?.state).toBe('anchor');
    expect(anchorStop?.hex).toBe('#dc2626');
  });

  it('keeps constant hue behavior backward-compatible', () => {
    const config = createDefaultConfig();
    const stops = generateRamp(config.theme, {
      ...config.ramp,
      hue: 210,
      huePreset: undefined,
      anchor: undefined,
    });

    expect(stops.find((stop) => stop.index === 300)?.oklch.h).toBe(210);
    expect(stops.find((stop) => stop.index === 800)?.oklch.h).toBe(210);
  });

  it('interpolates hue clockwise, counterclockwise, and through wraparound', () => {
    const config = createDefaultConfig();
    const clockwise = { ...config.ramp, anchor: undefined, huePreset: { type: 'range' as const, start: 350, end: 10, rotation: 'clockwise' as const, curve: 'linear' as const, direction: 'easeInOut' as const } };
    const counter = { ...config.ramp, anchor: undefined, huePreset: { type: 'range' as const, start: 10, end: 350, rotation: 'counter' as const, curve: 'linear' as const, direction: 'easeInOut' as const } };

    expect(hueForStop(500, clockwise)).toBeCloseTo(0);
    expect(hueForStop(500, counter)).toBeCloseTo(0);
  });

  it('shapes hue interpolation progress with curve direction', () => {
    expect(shapedProgress(0.5, 'linear', 'easeIn')).toBe(0.5);
    expect(shapedProgress(0.5, 'quad', 'easeIn')).toBeCloseTo(0.25);
    expect(shapedProgress(0.5, 'quad', 'easeOut')).toBeCloseTo(0.75);
    expect(shapedProgress(0.25, 'quad', 'easeInOut')).toBeCloseTo(0.125);
  });

  it('keeps all supported curve families bounded from 0 to 1', () => {
    const curves = ['linear', 'sine', 'quad', 'cubic', 'quart', 'quint', 'expo', 'circ', 'back'] as const;
    for (const curve of curves) {
      expect(shapedProgress(0, curve, 'easeInOut')).toBeGreaterThanOrEqual(0);
      expect(shapedProgress(1, curve, 'easeInOut')).toBeLessThanOrEqual(1);
    }
  });

  it('interpolates chroma from start to end', () => {
    const preset = {
      type: 'range' as const,
      start: 0.033,
      end: 0.096,
      rate: 1,
      curve: 'linear' as const,
      direction: 'easeInOut' as const,
    };

    expect(chromaForProgress(0, preset)).toBe(0.033);
    expect(chromaForProgress(1, preset)).toBe(0.096);
  });

  it('uses chroma rate to shape midpoint without changing endpoints', () => {
    const base = {
      type: 'range' as const,
      start: 0,
      end: 0.2,
      curve: 'linear' as const,
      direction: 'easeInOut' as const,
    };
    const rateOne = chromaForProgress(0.5, { ...base, rate: 1 });
    const rateTwo = chromaForProgress(0.5, { ...base, rate: 2 });

    expect(rateTwo).toBeLessThan(rateOne);
    expect(chromaForProgress(0, { ...base, rate: 2 })).toBe(0);
    expect(chromaForProgress(1, { ...base, rate: 2 })).toBe(0.2);
  });

  it('warns when an active anchor hue is outside the selected hue path', () => {
    const config = createDefaultConfig();
    const ramp = setAnchor(
      {
        ...config.ramp,
        huePreset: {
          type: 'range',
          start: 200,
          end: 260,
          rotation: 'clockwise',
          curve: 'linear',
          direction: 'easeInOut',
        },
      },
      '#af261d',
      500,
      100,
    );

    expect(anchorHueIsOnPath(ramp)).toBe(false);
  });

  it('preserves exact anchor color even when hue range is enabled', () => {
    const config = createDefaultConfig();
    const ramp = setAnchor(
      {
        ...config.ramp,
        huePreset: {
          type: 'range',
          start: 180,
          end: 260,
          rotation: 'clockwise',
          curve: 'linear',
          direction: 'easeInOut',
        },
      },
      '#dc2626',
      500,
      100,
    );
    const anchorStop = generateRamp(config.theme, ramp).find((stop) => stop.index === 500);

    expect(anchorStop?.hex).toBe('#dc2626');
  });

  it('treats a valid sRGB anchor blue as in gamut', () => {
    const config = createDefaultConfig();
    const ramp = setAnchor(config.ramp, '#005ABB', 500, 100);
    const anchorStop = generateRamp(config.theme, ramp).find((stop) => stop.index === 500);

    expect(anchorStop?.inGamut).toBe(true);
    expect(anchorStop?.hex.toLowerCase()).toBe('#005abb');
  });

  it('keeps endpoints unchanged after anchor smoothing', () => {
    const config = createDefaultConfig();
    const ramp = setAnchor(config.ramp, '#16a34a', 550, 50);
    const stops = generateRamp(config.theme, ramp);

    expect(stops.find((stop) => stop.index === 0)?.oklch.l).toBeCloseTo(config.theme.lMax);
    expect(stops.find((stop) => stop.index === 1000)?.oklch.l).toBeCloseTo(config.theme.lMin);
  });

  it('smooths intermediate stops around a canonical anchor', () => {
    const config = createDefaultConfig();
    const ramp = setAnchor(
      {
        ...config.ramp,
        stops: addStop(config.ramp.stops, 450),
      },
      '#dc2626',
      500,
      100,
    );
    const stops = generateRamp(config.theme, ramp);
    const stop450 = stops.find((stop) => stop.index === 450);
    const defaultLightnessAt450 = config.theme.lMax + (config.theme.lMin - config.theme.lMax) * 0.45;

    expect(Math.abs((stop450?.oklch.l ?? 0) - defaultLightnessAt450)).toBeGreaterThan(0.005);
  });

  it('keeps generated stops in gamut after mapping', () => {
    const config = createDefaultConfig();
    const ramp = {
      ...config.ramp,
      chromaPreset: { type: 'range' as const, start: 0, end: 0.5, rate: 1, curve: 'sine' as const, direction: 'easeInOut' as const },
    };
    const stops = generateRamp(config.theme, ramp);

    expect(stops.every((stop) => stop.inGamut)).toBe(true);

    const visibleValidation = validateGeneratedStops(stops);
    expect(visibleValidation.hasBlockingIssues).toBe(false);
    expect(visibleValidation.blockingStops).toHaveLength(0);
    expect(visibleValidation.warningStops).toHaveLength(0);
  });

  it('produces export strings and contrast values', () => {
    const config = createDefaultConfig();
    const stops = generateRamp(config.theme, config.ramp);
    const bundle = createExportBundle(config, stops);

    expect(bundle.cssVariables).toContain('--color-brand-500');
    expect(bundle.jsonConfig).toContain('"version": 1');
    expect(bundle.table).toContain('#af261d');
    expect(stops[0].contrastOnBlack).toBeGreaterThan(1);
    expect(stops[0].labelColor).toBe('#111111');
    expect(stops.at(-1)?.labelColor).toBe('#ffffff');
  });
});

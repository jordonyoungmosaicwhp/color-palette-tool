import Color from 'colorjs.io';
import { describe, expect, it } from 'vitest';
import {
  addStop,
  createDefaultConfig,
  createExportBundle,
  deleteStop,
  customStopCollisionIndices,
  customStopIndex,
  generateRamp,
  chromaForProgress,
  hueForProgress,
  normalizeHueDirection,
  insertStopBetween,
  setAnchor,
  resnapAnchorStops,
  resolveHuePathDirection,
  shapedProgress,
  validateGeneratedStops,
} from '../src/lib/color';

describe('OKLCH ramp engine', () => {
  it('generates canonical stops from lightness endpoints', () => {
    const config = createDefaultConfig();
    const stops = generateRamp(config.theme, config.ramp);

    expect(config.theme.lMax).toBe(1);
    expect(config.ramp.anchor).toBeUndefined();
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

  it('passes through custom stops at their derived positions', () => {
    const config = createDefaultConfig();
    const ramp = {
      ...config.ramp,
      customStops: [
        { id: 'custom-stop-1', color: 'oklch(0.8 0.08 30)' },
        { id: 'custom-stop-2', color: 'oklch(0.6 0.08 60)' },
      ],
    };
    const stops = generateRamp(config.theme, ramp);
    const firstIndex = customStopIndex('oklch(0.8 0.08 30)', config.theme);
    const secondIndex = customStopIndex('oklch(0.6 0.08 60)', config.theme);
    const first = stops.find((stop) => stop.index === firstIndex);
    const second = stops.find((stop) => stop.index === secondIndex);

    expect(first?.oklch.l).toBeCloseTo(0.8, 3);
    expect(first?.oklch.h).toBeCloseTo(30, 0);
    expect(second?.oklch.l).toBeCloseTo(0.6, 3);
    expect(second?.oklch.h).toBeCloseTo(60, 0);
  });

  it('reports calculated stop collisions for duplicate custom stop positions', () => {
    const theme = createDefaultConfig().theme;
    const collisions = customStopCollisionIndices(
      [
        { id: 'custom-stop-1', color: 'oklch(0.8 0.08 30)' },
        { id: 'custom-stop-2', color: 'oklch(0.8 0.05 150)' },
        { id: 'custom-stop-3', color: 'oklch(0.6 0.08 60)' },
      ],
      theme,
    );

    expect(collisions).toEqual([customStopIndex('oklch(0.8 0.08 30)', theme)]);
  });

  it('passes through start, center, and end hues exactly', () => {
    const preset = {
      start: 350,
      center: 0,
      end: 20,
      centerPosition: 0.5,
      startShape: 0,
      endShape: 0,
      direction: 'auto' as const,
    };

    expect(hueForProgress(0, preset)).toBeCloseTo(350);
    expect(hueForProgress(0.5, preset)).toBeCloseTo(0);
    expect(hueForProgress(1, preset)).toBeCloseTo(20);
  });

  it('moves the midpoint without changing endpoint values', () => {
    const preset = {
      start: 20,
      center: 60,
      end: 120,
      centerPosition: 0.25,
      startShape: 0,
      endShape: 0,
      direction: 'clockwise' as const,
    };

    expect(hueForProgress(0, preset)).toBeCloseTo(20);
    expect(hueForProgress(0.25, preset)).toBeCloseTo(60);
    expect(hueForProgress(1, preset)).toBeCloseTo(120);
  });

  it('treats hue shape as bounded tangent strength', () => {
    const soft = {
      start: 20,
      center: 60,
      end: 120,
      centerPosition: 0.5,
      startShape: 0,
      endShape: 0,
      direction: 'clockwise' as const,
    };
    const strong = {
      ...soft,
      startShape: 1,
      endShape: 1,
    };

    expect(hueForProgress(0.25, strong)).not.toBe(hueForProgress(0.25, soft));
    expect(hueForProgress(0.75, strong)).not.toBe(hueForProgress(0.75, soft));
  });

  it('keeps increasing and decreasing hue segments within their endpoint bounds', () => {
    const increasing = {
      start: 20,
      center: 60,
      end: 120,
      centerPosition: 0.5,
      startShape: 1,
      endShape: 1,
      direction: 'clockwise' as const,
    };
    const decreasing = {
      start: 120,
      center: 60,
      end: 20,
      centerPosition: 0.5,
      startShape: 1,
      endShape: 1,
      direction: 'counterclockwise' as const,
    };

    for (const value of Array.from({ length: 21 }, (_, index) => index / 20)) {
      const rising = hueForProgress(value, increasing);
      const falling = hueForProgress(value, decreasing);

      expect(rising).toBeGreaterThanOrEqual(20);
      expect(rising).toBeLessThanOrEqual(120);
      expect(falling).toBeGreaterThanOrEqual(20);
      expect(falling).toBeLessThanOrEqual(120);
    }
  });

  it('keeps hump and valley hue profiles smooth at the midpoint knot', () => {
    const epsilon = 0.001;
    const hump = {
      start: 20,
      center: 80,
      end: 20,
      centerPosition: 0.5,
      startShape: 0.75,
      endShape: 0.75,
      direction: 'clockwise' as const,
    };
    const valley = {
      start: 80,
      center: 20,
      end: 80,
      centerPosition: 0.5,
      startShape: 0.75,
      endShape: 0.75,
      direction: 'clockwise' as const,
    };

    expect(hueForProgress(0.5 - epsilon, hump)).toBeCloseTo(hueForProgress(0.5 + epsilon, hump), 2);
    expect(hueForProgress(0.5 - epsilon, valley)).toBeCloseTo(hueForProgress(0.5 + epsilon, valley), 2);
  });

  it('resolves clockwise and counterclockwise hue paths across wraparound', () => {
    const clockwise = {
      start: 350,
      center: 0,
      end: 20,
      centerPosition: 0.5,
      startShape: 0,
      endShape: 0,
      direction: 'clockwise' as const,
    };
    const counter = {
      start: 10,
      center: 0,
      end: 350,
      centerPosition: 0.5,
      startShape: 0,
      endShape: 0,
      direction: 'counterclockwise' as const,
    };

    expect(resolveHuePathDirection(clockwise)).toBe('clockwise');
    expect(resolveHuePathDirection(counter)).toBe('counterclockwise');
    expect(hueForProgress(0.5, clockwise)).toBeCloseTo(0);
    expect(hueForProgress(0.5, counter)).toBeCloseTo(0);
  });

  it('can change hue direction between the midpoint segments when auto fits better', () => {
    const preset = {
      start: 350,
      center: 10,
      end: 330,
      centerPosition: 0.5,
      startShape: 0,
      endShape: 0,
      direction: 'auto' as const,
    };

    expect(hueForProgress(0.25, preset)).toBeCloseTo(0, 0);
    expect(hueForProgress(0.75, preset)).toBeCloseTo(350, 0);
  });

  it('falls back to auto when an explicit direction would skip the midpoint', () => {
    const preset = {
      start: 30,
      center: 280,
      end: 60,
      centerPosition: 0.5,
      startShape: 0,
      endShape: 0,
      direction: 'clockwise' as const,
    };

    expect(normalizeHueDirection(preset)).toBe('auto');
    expect(resolveHuePathDirection(preset)).toBe('counterclockwise');
  });

  it('shapes hue interpolation progress with curve direction', () => {
    expect(shapedProgress(0.5, 'linear', 'easeIn')).toBe(0.5);
    expect(shapedProgress(0.5, 'quad', 'easeIn')).toBeCloseTo(0.25);
    expect(shapedProgress(0.5, 'quad', 'easeOut')).toBeCloseTo(0.75);
    expect(shapedProgress(0.25, 'quad', 'easeInOut')).toBeCloseTo(0.125);
  });

  it('keeps all supported curve families bounded from 0 to 1', () => {
    const curves = ['linear', 'sine', 'quad'] as const;
    for (const curve of curves) {
      expect(shapedProgress(0, curve, 'easeInOut')).toBeGreaterThanOrEqual(0);
      expect(shapedProgress(1, curve, 'easeInOut')).toBeLessThanOrEqual(1);
    }
  });

  it('passes through start, center, and end chroma exactly', () => {
    const preset = {
      start: 0.033,
      center: 0.081,
      end: 0.096,
      centerPosition: 0.5,
      startShape: 0,
      endShape: 0,
    };

    expect(chromaForProgress(0, preset)).toBe(0.033);
    expect(chromaForProgress(0.5, preset)).toBe(0.081);
    expect(chromaForProgress(1, preset)).toBe(0.096);
  });

  it('moves the midpoint without changing endpoint values', () => {
    const preset = {
      start: 0,
      center: 0.14,
      end: 0.2,
      centerPosition: 0.25,
      startShape: 0,
      endShape: 0,
    };

    expect(chromaForProgress(0, preset)).toBe(0);
    expect(chromaForProgress(0.25, preset)).toBe(0.14);
    expect(chromaForProgress(1, preset)).toBe(0.2);
  });

  it('treats shape as bounded tangent strength', () => {
    const soft = {
      start: 0,
      center: 0.08,
      end: 0.16,
      centerPosition: 0.5,
      startShape: 0,
      endShape: 0,
    };
    const strong = {
      ...soft,
      startShape: 1,
      endShape: 1,
    };

    expect(chromaForProgress(0.25, strong)).not.toBe(chromaForProgress(0.25, soft));
    expect(chromaForProgress(0.75, strong)).not.toBe(chromaForProgress(0.75, soft));
  });

  it('keeps increasing and decreasing segments within their endpoint bounds', () => {
    const increasing = {
      start: 0.02,
      center: 0.09,
      end: 0.17,
      centerPosition: 0.5,
      startShape: 1,
      endShape: 1,
    };
    const decreasing = {
      start: 0.17,
      center: 0.09,
      end: 0.02,
      centerPosition: 0.5,
      startShape: 1,
      endShape: 1,
    };

    for (const value of Array.from({ length: 21 }, (_, index) => index / 20)) {
      const rising = chromaForProgress(value, increasing);
      const falling = chromaForProgress(value, decreasing);

      expect(rising).toBeGreaterThanOrEqual(0.02);
      expect(rising).toBeLessThanOrEqual(0.17);
      expect(falling).toBeGreaterThanOrEqual(0.02);
      expect(falling).toBeLessThanOrEqual(0.17);
    }
  });

  it('keeps hump and valley profiles smooth at the center knot', () => {
    const epsilon = 0.001;
    const hump = {
      start: 0.05,
      center: 0.18,
      end: 0.05,
      centerPosition: 0.5,
      startShape: 0.75,
      endShape: 0.75,
    };
    const valley = {
      start: 0.18,
      center: 0.05,
      end: 0.18,
      centerPosition: 0.5,
      startShape: 0.75,
      endShape: 0.75,
    };

    expect(chromaForProgress(0.5 - epsilon, hump)).toBeCloseTo(chromaForProgress(0.5 + epsilon, hump), 3);
    expect(chromaForProgress(0.5 - epsilon, valley)).toBeCloseTo(chromaForProgress(0.5 + epsilon, valley), 3);
  });

  it('preserves exact anchor color even when hue locking is enabled', () => {
    const config = createDefaultConfig();
    const ramp = setAnchor(
      {
        ...config.ramp,
        huePreset: {
          start: 180,
          center: 220,
          end: 260,
          centerPosition: 0.5,
          startShape: 0,
          endShape: 0,
          direction: 'clockwise',
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

  it('resnaps anchor-origin stops when theme lightness changes', () => {
    const config = createDefaultConfig();
    const anchored = setAnchor(config.ramp, 'oklch(49.4% 0.08 0)', 575, 25);
    const nextTheme = { lMax: 0.6953846153846154, lMin: 0.2 };
    const resnapped = resnapAnchorStops(anchored, nextTheme);

    expect(anchored.stops.some((stop) => stop.index === 575 && stop.origin === 'anchor')).toBe(true);
    expect(resnapped.anchor?.stop).toBe(400);
    expect(resnapped.stops.some((stop) => stop.index === 575)).toBe(false);
    expect(resnapped.stops.some((stop) => stop.index === 400 && stop.origin === 'anchor')).toBe(true);
  });

  it('preserves user-authored minor stops when resnapping anchors', () => {
    const config = createDefaultConfig();
    const withUserStop = addStop(config.ramp.stops, 575);
    const anchored = setAnchor({ ...config.ramp, stops: withUserStop }, 'oklch(49.4% 0.08 0)', 575, 25);
    const nextTheme = { lMax: 0.6953846153846154, lMin: 0.2 };
    const resnapped = resnapAnchorStops(anchored, nextTheme);

    expect(resnapped.stops.some((stop) => stop.index === 575 && stop.origin === 'user')).toBe(true);
    expect(resnapped.stops.some((stop) => stop.index === 400 && stop.origin === 'anchor')).toBe(true);
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

  it('keeps generated stops and exported values in gamut after mapping', () => {
    const config = createDefaultConfig();
    const ramp = {
      ...config.ramp,
      chromaPreset: { start: 0, center: 0.25, end: 0.5, centerPosition: 0.5, startShape: 0.5, endShape: 0.5 },
    };
    const stops = generateRamp(config.theme, ramp);

    expect(stops.every((stop) => stop.inGamut)).toBe(true);
    expect(
      stops.every((stop) => new Color('oklch', [stop.oklch.l, stop.oklch.c, stop.oklch.h]).inGamut('srgb')),
    ).toBe(true);

    const visibleValidation = validateGeneratedStops(stops);
    expect(visibleValidation.hasBlockingIssues).toBe(false);
    expect(visibleValidation.blockingStops).toHaveLength(0);
    expect(visibleValidation.warningStops).toHaveLength(0);

    const bundle = createExportBundle(config, stops);
    expect(bundle.cssVariables).toContain('oklch(');
    expect(bundle.table).toMatch(/^\d+\t#[0-9a-f]{6}\toklch/m);
  });

  it('produces export strings and contrast values', () => {
    const config = createDefaultConfig();
    const stops = generateRamp(config.theme, config.ramp);
    const bundle = createExportBundle(config, stops);

    expect(bundle.cssVariables).toContain('--color-brand-500');
    expect(bundle.jsonConfig).toContain('"version": 1');
    expect(bundle.table).toMatch(/#[0-9a-f]{6}/i);
    expect(stops[0].contrastOnBlack).toBeGreaterThan(1);
    expect(stops[0].labelColor).toBe('#111111');
    expect(stops.at(-1)?.labelColor).toBe('#ffffff');
  });
});

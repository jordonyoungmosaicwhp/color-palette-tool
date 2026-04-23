import { expect, test } from '@playwright/test';
import { createSeededRampConfig } from '../../src/lib/color';
import { createWorkspaceExportBundle } from '../../src/features/ramp/workspaceSerialization';

test('edits a single ramp without surfacing out-of-gamut states', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'OKLCH Palette Tool' })).toBeVisible();
  await expect(page.getByText('Primary Brand Colors')).toBeVisible();

  await page.getByLabel('L max').fill('96');
  await page.getByLabel('L min').fill('10');
  await page.getByText('Row').click();

  await page.getByRole('button', { name: 'Insert stop' }).first().click();
  await expect(page.getByRole('button', { name: /Hide stop/i }).first()).toBeVisible();

  await page.getByLabel('Anchor color').fill('#dc2626');
  await page.getByRole('button', { name: 'Apply Anchor' }).click();

  await page.getByRole('button', { name: 'Delete stop' }).last().click();

  await page.getByRole('slider', { name: 'End chroma' }).press('End');
  await page.getByRole('button', { name: 'Export Palette' }).click();
  await expect(page.getByRole('button', { name: 'Copy' })).toBeEnabled();
  await expect(page.getByText(/out of sRGB gamut/i)).toHaveCount(0);
});

test('imports a palette JSON document from the top bar', async ({ page }) => {
  await page.goto('/');

  const imported = createWorkspaceExportBundle({
    theme: { lMax: 0.96, lMin: 0.1 },
    displayMode: 'row',
    displayOptions: {
      allowHiddenStops: true,
      showHex: true,
      showLightness: true,
      showChroma: false,
      showHue: false,
    },
    selectedRampId: 'teal-ramp',
    selectedStop: 500,
    groups: [
      {
        id: 'imported-section',
        name: 'Imported Section',
        ramps: [
          {
            id: 'teal-ramp',
            name: 'Teal',
            config: createSeededRampConfig('Teal', '#0f766e', 0.04, 0.14),
          },
        ],
      },
    ],
  });

  await page.getByRole('button', { name: 'Import' }).click();
  await page.getByPlaceholder('Paste exported palette JSON here').fill(imported.jsonConfig);
  await page.getByRole('button', { name: 'Apply' }).click({ force: true });

  await expect(page.getByRole('navigation', { name: 'Collections' }).getByRole('link', { name: 'Imported Section' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Teal' })).toBeVisible();
});

test('drags a ramp between groups from the left sidebar', async ({ page }, testInfo) => {
  test.skip(/mobile/i.test(testInfo.project.name), 'Drag-and-drop is only exposed in the expanded desktop sidebar.');

  await page.goto('/');

  const utilityGroup = page.locator('[data-group-dropzone="utility"]');
  const utilityBounds = await utilityGroup.boundingBox();

  expect(utilityBounds).not.toBeNull();

  await page.locator('[data-drag-handle="red"]').dragTo(utilityGroup, {
    targetPosition: {
      x: 16,
      y: Math.max((utilityBounds?.height ?? 0) - 6, 6),
    },
  });

  const utilityNames = await page
    .locator('[data-group-dropzone="utility"] [data-ramp-select]')
    .evaluateAll((elements) => elements.map((element) => element.textContent?.trim() ?? ''));

  expect(utilityNames).toEqual(['Blue', 'Green', 'Yellow', 'Orange', 'Red']);

  const utilitySectionNames = await page
    .locator('#utility article')
    .evaluateAll((elements) => elements.map((element) => element.querySelector('header button')?.textContent?.trim() ?? ''));

  expect(utilitySectionNames).toEqual(['Blue', 'Green', 'Yellow', 'Orange', 'Red']);
});

test('closes the first sidebar move menu after moving a ramp', async ({ page }, testInfo) => {
  test.skip(/mobile/i.test(testInfo.project.name), 'Move controls are only exposed in the expanded desktop sidebar.');

  await page.goto('/');

  await page.getByRole('button', { name: 'Neutral reorder options' }).click();
  await page.getByRole('menuitem', { name: 'Move down' }).click();

  await expect(page.getByRole('menuitem', { name: 'Move down' })).toHaveCount(0);

  const brandNames = await page
    .locator('[data-group-dropzone="neutral-brand"] [data-ramp-select]')
    .evaluateAll((elements) => elements.map((element) => element.textContent?.trim() ?? ''));

  expect(brandNames).toEqual(['Red', 'Neutral']);
});

test('closes the first sidebar move menu after moving a ramp to another group', async ({ page }, testInfo) => {
  test.skip(/mobile/i.test(testInfo.project.name), 'Move controls are only exposed in the expanded desktop sidebar.');

  await page.goto('/');

  await page.getByRole('button', { name: 'Neutral reorder options' }).click();
  await page.getByRole('menuitem', { name: 'Move to next group' }).click();

  await expect(page.getByRole('menuitem', { name: 'Move to next group' })).toHaveCount(0);

  const brandNames = await page
    .locator('[data-group-dropzone="neutral-brand"] [data-ramp-select]')
    .evaluateAll((elements) => elements.map((element) => element.textContent?.trim() ?? ''));
  const utilityNames = await page
    .locator('[data-group-dropzone="utility"] [data-ramp-select]')
    .evaluateAll((elements) => elements.map((element) => element.textContent?.trim() ?? ''));

  expect(brandNames).toEqual(['Red']);
  expect(utilityNames).toEqual(['Blue', 'Green', 'Yellow', 'Orange', 'Neutral']);
});

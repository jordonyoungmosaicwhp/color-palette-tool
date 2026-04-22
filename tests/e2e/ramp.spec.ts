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

test('imports a workspace JSON snapshot from the top bar', async ({ page }) => {
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
  await page.getByLabel('Workspace JSON').fill(imported.jsonConfig);
  await page.getByRole('button', { name: 'Apply' }).click();

  await expect(page.getByText('Imported Section')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Teal' })).toBeVisible();
});

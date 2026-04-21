import { expect, test } from '@playwright/test';

test('edits a single ramp and blocks invalid export', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'OKLCH Palette Tool' })).toBeVisible();
  await expect(page.getByText('Primary Brand Colors')).toBeVisible();

  await page.getByLabel('L max').fill('96');
  await page.getByLabel('L min').fill('10');
  await page.getByText('Row').click();

  await page.getByRole('button', { name: 'Insert stop' }).first().click();
  await expect(page.getByRole('button', { name: /Hide stop/i }).first()).toBeVisible();

  await page.getByLabel('Anchor color').fill('#dc2626');
  await expect(page.getByText(/Auto stop/i)).toBeVisible();

  await page.getByRole('button', { name: 'Delete stop' }).last().click();

  await page.getByRole('slider', { name: 'End chroma' }).press('End');
  await page.getByRole('button', { name: 'Export Palette' }).click();
  await expect(page.getByRole('button', { name: 'Copy' })).toBeDisabled();
  await expect(page.getByText(/out of sRGB gamut/i)).toBeVisible();
});

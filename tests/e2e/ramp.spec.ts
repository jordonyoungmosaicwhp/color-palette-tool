import { expect, test } from '@playwright/test';

test('edits a single ramp without surfacing out-of-gamut states', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'OKLCH Palette Tool' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Core', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Open settings' }).click();
  await page.getByLabel('L max', { exact: true }).fill('96');
  await page.getByLabel('L min', { exact: true }).fill('10');
  await page.getByText('Row', { exact: true }).click({ force: true });

  await page.getByRole('button', { name: 'Insert stop' }).first().click({ force: true });
  await expect(page.getByRole('button', { name: /Hide stop/i }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Export Palette' }).click({ force: true });
  await expect(page.getByRole('button', { name: 'Copy' })).toBeEnabled();
  await expect(page.getByText(/out of sRGB gamut/i)).toHaveCount(0);
});

test('imports a palette JSON document from the top bar', async ({ page }) => {
  await page.goto('/');

  const imported = JSON.stringify(
    {
      version: 2,
      theme: { lMax: 0.96, lMin: 0.1 },
      collections: [
        {
          name: 'Imported Collection',
          groups: [
            {
              name: 'Imported Group',
              ramps: [
                {
                  mode: 'customStops',
                  name: 'Teal',
                  hue: { start: 186.39, end: 186.39 },
                  chroma: { start: 0.04, end: 0.14 },
                  customStops: ['#0f766e'],
                },
              ],
            },
          ],
        },
      ],
    },
    null,
    2,
  );

  await page.getByRole('button', { name: 'Import' }).click();
  await page.getByPlaceholder('Paste exported palette JSON here').fill(imported);
  await page.getByRole('button', { name: 'Apply' }).click({ force: true });

  await expect(page.getByRole('heading', { name: 'Teal' })).toBeVisible();
});

test('switches the active collection from the left tree', async ({ page }) => {
  await page.goto('/');

  await page.locator('[data-collection-select="openai"]').click();

  await expect(page.locator('#utility')).toBeVisible();
  await expect(page.locator('#utility').getByRole('button', { name: 'Blue', exact: true })).toBeVisible();
  await expect(page.locator('#neutral')).toHaveCount(0);
});

test('drags a ramp between groups across collections from the left sidebar', async ({ page }, testInfo) => {
  test.skip(/mobile/i.test(testInfo.project.name), 'Drag-and-drop is only exposed in the expanded desktop sidebar.');

  await page.goto('/');

  await page.getByRole('button', { name: 'Expand OpenAI' }).click();

  await page.evaluate(async () => {
    const source = document.querySelector<HTMLElement>('[data-ramp-id="red"]');
    const target = document.querySelector<HTMLElement>('[data-ramp-id="orange"]');
    if (!source || !target) throw new Error('Ramp rows not found for drag test.');

    const dataTransfer = new DataTransfer();
    const bounds = target.getBoundingClientRect();
    const clientY = bounds.bottom - 6;

    source.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer }));
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer, clientY }));
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer, clientY }));
    source.dispatchEvent(new DragEvent('dragend', { bubbles: true, cancelable: true, dataTransfer }));
  });

  const utilityNames = await page
    .locator('[data-group-dropzone="utility"] [data-ramp-select]')
    .evaluateAll((elements) => elements.map((element) => element.textContent?.trim() ?? ''));

  expect(utilityNames).toEqual(['Blue', 'Green', 'Yellow', 'Orange', 'Red']);

  await page.locator('[data-collection-select="openai"]').click();

  const utilitySectionNames = await page
    .locator('#utility article')
    .evaluateAll((elements) => elements.map((element) => element.querySelector('header button')?.textContent?.trim() ?? ''));

  expect(utilitySectionNames).toEqual(['Blue', 'Green', 'Yellow', 'Orange', 'Red']);
});

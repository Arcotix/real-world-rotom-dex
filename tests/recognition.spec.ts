import { expect, test, type Page } from '@playwright/test';
import sharp from 'sharp';

async function mockRecognition(page: Page, result: object, failFirst = false) {
  const png = await sharp({ create: { width: 20, height: 20, channels: 4, background: '#0000' } }).png().toBuffer();
  let attempts = 0;
  await page.route('**:8787/photos/**', async (route) => {
    if (route.request().method() !== 'PUT') return route.continue();
    if (failFirst && attempts++ === 0) return route.abort();
    await route.fulfill({ status: 201, contentType: 'image/png', body: png, headers: {
      'Access-Control-Allow-Origin': '*', 'Access-Control-Expose-Headers': 'X-Object-Recognition',
      'X-Object-Recognition': JSON.stringify(result),
    } });
  });
}

test('recognized objects display their name and shoot stars and confetti from both corners', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await mockRecognition(page, { status: 'recognized', label: 'computer mouse', score: 0.92 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Capture photo' }).click();
  await expect(page.getByTestId('recognition-result')).toHaveText('Computer mouse', { timeout: 10000 });
  await expect(page.getByTestId('recognition-celebration')).toBeVisible();
  const left = page.getByTestId('recognition-star-0');
  const right = page.getByTestId('recognition-star-1');
  await expect(left).toBeAttached();
  await expect(right).toBeAttached();
  await expect(page.getByTestId('recognition-confetti-2')).toBeAttached();
  await expect(page.getByTestId('recognition-confetti-3')).toBeAttached();
  await page.waitForTimeout(250);
  const initial = await left.evaluate((element) => getComputedStyle(element).transform);
  const leftBox = (await left.boundingBox())!;
  const rightBox = (await right.boundingBox())!;
  expect(leftBox.x).toBeLessThan(rightBox.x);
  expect(leftBox.y).toBeLessThan(804);
  await page.screenshot({ path: 'output/app-preview/recognition-celebration.png' });
  await page.waitForTimeout(150);
  expect(await left.evaluate((element) => getComputedStyle(element).transform)).not.toBe(initial);
  await expect(page.getByTestId('recognition-celebration')).toHaveCount(0);
  await expect(page.getByTestId('recognition-result')).toHaveText('Computer mouse');
  await page.getByRole('button', { name: 'Retake photo' }).click();
  await expect(page.getByTestId('recognition-result')).toHaveCount(0);
  expect(errors).toEqual([]);
});

for (const status of ['uncertain', 'unavailable']) {
  test(`${status} recognition saves without celebrating`, async ({ page }) => {
    await mockRecognition(page, { status });
    await page.goto('/');
    await page.getByRole('button', { name: 'Capture photo' }).click();
    await expect(page.getByTestId('recognition-result')).toContainText(status === 'uncertain' ? 'Not sure yet' : 'Creature unavailable', { timeout: 10000 });
    await expect(page.getByTestId('recognition-celebration')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Retake photo' })).toBeEnabled();
  });
}

test('retrying a failed upload can recognize and celebrate the retained photo', async ({ page }) => {
  await mockRecognition(page, { status: 'recognized', label: 'stapler', score: 0.88 }, true);
  await page.goto('/');
  await page.getByRole('button', { name: 'Capture photo' }).click();
  await expect(page.getByRole('button', { name: 'Retry save' })).toBeEnabled({ timeout: 10000 });
  await expect(page.getByTestId('recognition-celebration')).toHaveCount(0);
  await page.getByRole('button', { name: 'Retry save' }).click();
  await expect(page.getByTestId('recognition-result')).toHaveText('Stapler');
  await expect(page.getByTestId('recognition-celebration')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry save' })).toHaveCount(0);
});

test('reduced motion uses stationary stars without flying confetti', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockRecognition(page, { status: 'recognized', label: 'pen', score: 0.9 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Capture photo' }).click();
  await expect(page.getByTestId('recognition-result')).toHaveText('Pen', { timeout: 10000 });
  await expect(page.getByTestId('recognition-star-0')).toBeAttached();
  await expect(page.getByTestId('recognition-star-5')).toBeAttached();
  await expect(page.locator('[data-testid^="recognition-confetti-"]')).toHaveCount(0);
  expect(await page.getByTestId('recognition-star-0').evaluate((element) => getComputedStyle(element).transform)).toBe('none');
  await expect(page.getByTestId('recognition-celebration')).toHaveCount(0);
});

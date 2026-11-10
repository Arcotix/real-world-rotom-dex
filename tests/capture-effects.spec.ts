import { expect, test } from '@playwright/test';
import sharp from 'sharp';

async function opacity(page: import('@playwright/test').Page, id: string) {
  return page.getByTestId(id).evaluate((element) => Number(getComputedStyle(element).opacity));
}

async function transform(page: import('@playwright/test').Page, id: string) {
  return page.getByTestId(id).evaluate((element) => getComputedStyle(element).transform);
}

test('holding darkens without capturing; release spins, stays dim while processing, and plays the sound', async ({ page }) => {
  test.setTimeout(45000);
  let uploads = 0;
  let releaseUpload!: () => void;
  const uploadGate = new Promise<void>((resolve) => { releaseUpload = resolve; });
  const png = await sharp({ create: { width: 4, height: 4, channels: 4, background: '#0000' } }).png().toBuffer();
  await page.route('**:8787/photos/**', async (route) => {
    if (route.request().method() !== 'PUT') return route.continue();
    uploads++;
    await uploadGate;
    await route.fulfill({ status: 201, contentType: 'image/png', headers: { 'Access-Control-Allow-Origin': '*' }, body: png });
  });
  await page.addInitScript(() => {
    const sounds: number[] = [];
    Object.assign(window, { captureSounds: sounds });
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      this.addEventListener('playing', () => { if (this.tagName === 'AUDIO') sounds.push(this.duration); }, { once: true });
      return play.call(this);
    };
  });
  await page.goto('/');
  const button = page.getByRole('button', { name: /Capture photo|Retake photo/ });
  await expect(button).toBeEnabled();
  const preview = (await page.getByTestId('back-camera').boundingBox())!;
  // The camera must end inside the artwork, above the phone's bottom margin.
  expect(preview.y + preview.height).toBeLessThan(800);
  const box = (await button.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect.poll(() => opacity(page, 'capture-ball-shade')).toBeGreaterThan(0.35);
  await expect.poll(() => opacity(page, 'capture-scene-dim')).toBeGreaterThan(0.1);
  await page.waitForTimeout(550); // Deliberately keep the finger down past the long-press threshold.
  expect(uploads).toBe(0);
  await expect(button).toBeEnabled();
  await expect.poll(() => opacity(page, 'capture-edge-loader')).toBe(0);
  await page.screenshot({ path: 'output/app-preview/capture-hold.png' });

  await page.evaluate(() => {
    const bezelFrames: { opacity: number; width: number; translation: number }[] = [];
    Object.assign(window, { bezelFrames });
    const end = performance.now() + 1300;
    const sample = () => {
      const bezel = document.querySelector('[data-testid="capture-bezel-left"]');
      const photo = document.querySelector('[data-testid="capture-photo-plane"]');
      if (bezel && photo) bezelFrames.push({ opacity: Number(getComputedStyle(bezel).opacity),
        width: photo.getBoundingClientRect().width, translation: new DOMMatrix(getComputedStyle(bezel).transform).m41 });
      if (performance.now() < end) requestAnimationFrame(sample);
    };
    sample();
  });
  await page.mouse.up();
  await expect(button).toBeDisabled();
  await expect.poll(() => uploads).toBe(1);
  await expect(page.getByTestId('back-camera')).toHaveCount(0);
  await expect(page.getByTestId('captured-photo')).toBeVisible();
  await expect(page.locator('video')).toHaveCount(0);
  await expect.poll(() => opacity(page, 'rotom-capture-frame')).toBeLessThan(0.02);
  const frames = await page.evaluate(() => (window as unknown as { bezelFrames: { opacity: number; width: number; translation: number }[] }).bezelFrames);
  expect(frames.some(frame => frame.opacity > 0.95 && frame.width < 350)).toBe(true);
  expect(frames.some(frame => frame.opacity > 0.1 && frame.opacity < 0.9 && frame.translation < -1 && frame.width < 389)).toBe(true);
  await expect.poll(() => opacity(page, 'capture-bezel-left')).toBe(0);
  const expanded = (await page.getByTestId('capture-photo-plane').boundingBox())!;
  expect(expanded.width).toBeCloseTo(390, 0);
  await expect.poll(() => opacity(page, 'capture-ball-shade')).toBeGreaterThan(0.35);
  const beforeSpin = await transform(page, 'capture-ball');
  await page.waitForTimeout(180);
  expect(await transform(page, 'capture-ball')).not.toBe(beforeSpin);
  await expect.poll(() => page.evaluate(() => (window as unknown as { captureSounds: number[] }).captureSounds.some((duration) => duration > 1.7 && duration < 1.9))).toBe(true);
  await expect.poll(() => opacity(page, 'capture-scene-dim')).toBeGreaterThan(0.18);
  await expect(page.getByTestId('creature-radial-flash')).toHaveCount(0);
  await expect(page.getByText(/Saved \d|Removing background/)).toHaveCount(0);
  await page.screenshot({ path: 'output/app-preview/capture-reveal.png' });

  await expect.poll(() => opacity(page, 'capture-edge-loader')).toBe(1);
  await expect.poll(() => opacity(page, 'capture-scene-dim')).toBeGreaterThan(0.18);
  const runner = page.getByTestId('capture-edge-runner');
  const firstOffset = await runner.getAttribute('stroke-dashoffset');
  await page.waitForTimeout(2300); // Keep processing pending beyond a complete circuit.
  expect(await runner.getAttribute('stroke-dashoffset')).not.toBe(firstOffset);
  await expect.poll(() => opacity(page, 'capture-edge-loader')).toBe(1);
  await page.screenshot({ path: 'output/app-preview/capture-edge-loading.png' });
  const saved = page.waitForResponse((response) => response.request().method() === 'PUT' && response.url().includes(':8787/photos/'));
  releaseUpload();
  await saved;
  await expect(page.getByTestId('capture-edge-loader')).not.toHaveAttribute('aria-busy', 'true');
  await page.waitForTimeout(100);
  const exitOpacity = await opacity(page, 'capture-edge-loader');
  expect(exitOpacity).toBeGreaterThan(0);
  expect(exitOpacity).toBeLessThan(1);
  await expect.poll(() => opacity(page, 'capture-edge-loader')).toBe(0);
  await expect(button).toBeEnabled({ timeout: 10000 });
  await expect.poll(() => opacity(page, 'rotom-capture-frame')).toBe(1);
  await expect.poll(() => opacity(page, 'capture-ball-shade')).toBe(0);
  await expect.poll(() => opacity(page, 'capture-scene-dim')).toBe(0);
  expect(uploads).toBe(1);
  await expect(page.getByRole('button', { name: 'Retake photo' })).toBeEnabled();
  await expect(page.getByTestId('back-camera')).toHaveCount(0);
  await page.getByRole('button', { name: 'Retake photo' }).click();
  await expect(page.getByTestId('back-camera')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Capture photo' })).toBeEnabled();
  await expect(page.getByTestId('captured-photo')).toHaveCount(0);
});

test('dragging off a held button cancels without a capture', async ({ page }) => {
  let uploads = 0;
  page.on('request', (request) => { if (request.method() === 'PUT' && request.url().includes('/photos/')) uploads++; });
  await page.goto('/');
  const button = page.getByRole('button', { name: /Capture photo|Retake photo/ });
  await expect(button).toBeEnabled();
  const box = (await button.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect.poll(() => opacity(page, 'capture-ball-shade')).toBeGreaterThan(0.35);
  await page.mouse.move(0, 0);
  await page.mouse.up();
  await expect.poll(() => opacity(page, 'capture-ball-shade')).toBe(0);
  await expect.poll(() => opacity(page, 'capture-scene-dim')).toBe(0);
  await expect(button).toBeEnabled();
  expect(uploads).toBe(0);
});

test('reduced motion avoids spinning and frame expansion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const png = await sharp({ create: { width: 4, height: 4, channels: 4, background: '#0000' } }).png().toBuffer();
  await page.route('**:8787/photos/**', async (route) => {
    if (route.request().method() !== 'PUT') return route.continue();
    await page.waitForTimeout(1200);
    await route.fulfill({ status: 201, contentType: 'image/png', headers: { 'Access-Control-Allow-Origin': '*' }, body: png });
  });
  await page.goto('/');
  const button = page.getByRole('button', { name: /Capture photo|Retake photo/ });
  await expect(button).toBeEnabled();
  await button.click();
  await expect(button).toBeDisabled();
  await page.waitForTimeout(850);
  expect(await page.getByTestId('capture-edge-runner').getAttribute('stroke-dashoffset')).toBe('0');
  await expect.poll(() => opacity(page, 'rotom-capture-frame')).toBe(1);
  expect(await transform(page, 'rotom-capture-frame')).toBe('matrix(1, 0, 0, 1, 0, 0)');
  expect(await transform(page, 'capture-ball')).toBe('matrix(1, 0, 0, 1, 0, 0)');
  await expect(button).toBeEnabled({ timeout: 10000 });
});

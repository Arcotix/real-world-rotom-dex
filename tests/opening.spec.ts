import { chromium, expect, test } from '@playwright/test';
import { readFile, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';

const createdPhotos = new Set<string>();
test.afterEach(async () => {
  for (const path of createdPhotos) {
    for (const artifact of [path, path.replace(/\.png$/, '.creature.png'), path.replace(/\.png$/, '.creature.json')]) {
      await unlink(artifact).catch(() => undefined);
    }
  }
  createdPhotos.clear();
});

test('opening crossfades over pre-rendered artwork without detaching the video early', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    const frames: { opacity: number; video: boolean; still: boolean; frame: boolean }[] = [];
    Object.assign(window, { handoffFrames: frames });
    const sample = () => {
      const overlay = document.querySelector('[data-testid="intro-handoff"]');
      if (document.querySelector('[data-testid="rotom-open"]') && overlay) {
        const still = document.querySelector('[data-testid="rotom-still-cover"] img') as HTMLImageElement | null;
        frames.push({ opacity: Number(getComputedStyle(overlay).opacity),
          video: !!overlay.querySelector('video'),
          still: !!still?.complete && !!still.naturalWidth,
          frame: !!document.querySelector('svg image[clip-path="url(#rotom-frame)"]'),
        });
      }
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  await page.goto('/');
  await expect(page.getByTestId('rotom-opening')).toBeVisible();
  await expect(page.getByTestId('intro-handoff')).toHaveCount(0, { timeout: 15000 });
  await expect(page.getByRole('button', { name: 'Capture photo' })).toBeEnabled();
  const frames = await page.evaluate(() => (window as unknown as { handoffFrames: { opacity: number; video: boolean; still: boolean; frame: boolean }[] }).handoffFrames);
  expect(frames.some(frame => frame.opacity > 0 && frame.opacity < 1)).toBe(true);
  expect(frames.every(frame => frame.video && frame.still && frame.frame), JSON.stringify(frames)).toBe(true);
  await expect(page.getByTestId('intro-handoff').locator('video')).toHaveCount(0);
  await expect(page.getByTestId('rotom-still-cover')).toHaveCSS('opacity', '0');
  expect(errors).toEqual([]);
});

test('startup does not wait for the SVG load event that cached Android bitmaps can skip', async ({ page }) => {
  await page.addInitScript(() => {
    Object.assign(window, { blockedSvgLoads: 0 });
    document.addEventListener('load', event => {
      if (event.target instanceof SVGImageElement) {
        (window as unknown as { blockedSvgLoads: number }).blockedSvgLoads++;
        event.stopImmediatePropagation();
      }
    }, true);
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Capture photo' })).toBeEnabled({ timeout: 10000 });
  await expect(page.getByTestId('intro-handoff')).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { blockedSvgLoads: number }).blockedSvgLoads)).toBeGreaterThan(0);
  await expect(page.getByRole('button', { name: 'Retry opening' })).toHaveCount(0);
});

test('startup and camera handoff do not depend on rendered still-image load events', async ({ page }) => {
  await page.addInitScript(() => {
    Object.assign(window, { blockedStillLoads: 0 });
    document.addEventListener('load', event => {
      if (event.target instanceof HTMLImageElement && event.target.closest('[data-testid="intro-handoff"], [data-testid="rotom-still-cover"]')) {
        (window as unknown as { blockedStillLoads: number }).blockedStillLoads++;
        event.stopImmediatePropagation();
      }
    }, true);
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Capture photo' })).toBeEnabled({ timeout: 10000 });
  await expect(page.getByTestId('intro-handoff')).toHaveCount(0);
  await expect(page.getByTestId('rotom-still-cover')).toHaveCSS('opacity', '0');
  expect(await page.evaluate(() => (window as unknown as { blockedStillLoads: number }).blockedStillLoads)).toBeGreaterThan(0);
  await expect(page.getByRole('button', { name: 'Retry opening' })).toHaveCount(0);
});

test('automatically plays the intro, opens the camera, and saves a timestamped capture', async ({ page }) => {
  test.setTimeout(480000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const events: { kind: string; time: number }[] = [];
    Object.assign(window, { mediaEvents: events });
    const originalPlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      this.addEventListener('playing', () => events.push({ kind: this.tagName, time: performance.now() }), { once: true });
      return originalPlay.call(this);
    };
  });
  await page.goto('/');
  await expect(page.getByTestId('rotom-black')).toBeVisible();
  await expect(page.getByTestId('rotom-opening')).toBeVisible();
  await expect(page.getByRole('button', { name: /Wake Rotom|Enable camera/ })).toHaveCount(0);
  await expect(page.getByTestId('back-camera')).toBeVisible();
  await expect(page.locator('svg image[clip-path="url(#rotom-frame)"]')).toBeVisible();
  await expect(page.getByRole('button', { name: /Capture photo|Retake photo/ })).toBeEnabled();
  const events = await page.evaluate(() => (window as unknown as { mediaEvents: { kind: string; time: number }[] }).mediaEvents);
  const audio = events.find((event) => event.kind === 'AUDIO');
  const video = events.find((event) => event.kind === 'VIDEO');
  expect(audio).toBeDefined();
  expect(video).toBeDefined();
  expect(Math.abs(audio!.time - video!.time)).toBeLessThan(250);

  const saved = page.waitForResponse((response) => response.url().includes(':8787/photos/') && response.request().method() === 'PUT', { timeout: 420000 });
  await page.getByRole('button', { name: /Capture photo|Retake photo/ }).click();
  const response = await saved;
  expect(response.status()).toBe(201);
  const fileName = response.headers()['x-photo-name'];
  expect(fileName).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.\d{3}Z\.png$/);
  const path = resolve('photos-store', fileName);
  createdPhotos.add(path);
  const photo = await readFile(path);
  expect([...photo.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  const metadata = await sharp(photo).metadata();
  expect(metadata.hasAlpha).toBe(false);
  await expect(page.getByRole('button', { name: /Retake photo|Take picture of new creature|Open Pokédex entry/ })).toBeEnabled({ timeout: 10000 });
  await expect(page.getByText(/Saved \d|Removing background/)).toHaveCount(0);
  await page.screenshot({ path: 'output/app-preview/camera-capture.png' });
  expect(errors).toEqual([]);
});

test('denied camera access has a settings recovery without an introductory prompt', async ({ page, context }) => {
  const cdp = await context.newCDPSession(page);
  const { targetInfo } = await cdp.send('Target.getTargetInfo');
  await cdp.send('Browser.setPermission', {
    permission: { name: 'camera' }, setting: 'denied', origin: 'http://localhost:8081', browserContextId: targetInfo.browserContextId,
  });
  await page.goto('/');
  await expect(page.getByTestId('opened-rotom')).toBeVisible();
  await page.getByRole('button', { name: 'Open settings' }).click();
  await expect(page.getByText('Allow camera access in your browser’s site settings, then reload this page.')).toBeVisible();
  await expect(page.getByTestId('back-camera')).toHaveCount(0);
});

test('a failed upload retains the capture and retries the same photo', async ({ page }) => {
  test.setTimeout(480000);
  await page.route('**:8787/photos/**', (route) => route.abort());
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Capture photo|Retake photo/ })).toBeEnabled();
  await page.getByRole('button', { name: /Capture photo|Retake photo/ }).click();
  await expect(page.getByRole('button', { name: 'Retry save' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Capture photo|Retake photo/ })).toBeDisabled();
  await page.unroute('**:8787/photos/**');
  const saved = page.waitForResponse((response) => response.url().includes(':8787/photos/') && response.request().method() === 'PUT', { timeout: 420000 });
  await page.getByRole('button', { name: 'Retry save' }).click();
  const response = await saved;
  expect(response.status()).toBe(201);
  const fileName = response.headers()['x-photo-name'];
  createdPhotos.add(resolve('photos-store', fileName));
  await expect(page.getByRole('button', { name: /Retake photo|Take picture of new creature|Open Pokédex entry/ })).toBeEnabled({ timeout: 10000 });
  await expect(page.getByText(/Saved \d|Removing background/)).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Retake photo|Take picture of new creature|Open Pokédex entry/ })).toBeEnabled();
});

test('a failed intro can be retried automatically', async ({ page }) => {
  await page.route('**/*rotom-wake-inner-grid-1s*', (route) => route.abort());
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Retry opening' })).toBeVisible();
  await page.unroute('**/*rotom-wake-inner-grid-1s*');
  await page.getByRole('button', { name: 'Retry opening' }).click();
  await expect(page.getByTestId('opened-rotom')).toBeVisible();
});

test('browser audio autoplay restrictions still allow automatic camera opening', async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=user-gesture-required', '--no-sandbox'],
  });
  try {
    const page = await browser.newPage();
    await page.goto('http://localhost:8081');
    await expect(page.getByRole('button', { name: /Capture photo|Retake photo/ })).toBeEnabled();
    await expect(page.getByRole('button', { name: /Wake Rotom|Enable camera|Retry opening/ })).toHaveCount(0);
  } finally {
    await browser.close();
  }
});

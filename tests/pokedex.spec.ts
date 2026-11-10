import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';

const stats = { health: 74, attack: 126, defense: 102, speed: 91, specialDefense: 118, specialAttack: 135 };
const savedEntry = (index: number) => ({
  schemaVersion: 1, id: `2026-11-11T12-30-00.${String(index).padStart(3, '0')}Z`,
  name: index === 0 ? 'Clickclaw' : `Ridge Companion ${index + 1}`,
  description: 'A tiny desk tyrant that wages a very dramatic war on loose clicks.',
  fieldNotes: 'A tiny desk tyrant that wages a very dramatic war on loose clicks.',
  object: 'computer mouse', element: 'Electric', category: 'The Desk Companion',
  heightCm: 12, weightKg: 0.15, stats, cry: 'aipom', capturedAt: '2026-11-11T12:30:00.000Z',
});

async function mockBox(page: Page, { count = 13, failFirst = false, failSecond = false, brokenImage = false, delay = 0, rarity }: { count?: number; failFirst?: boolean; failSecond?: boolean; brokenImage?: boolean; delay?: number; rarity?: string } = {}) {
  const portrait = await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><path d="M126 60Q94 34 128 8" stroke="#465e6c" fill="none" stroke-width="7"/><rect x="55" y="54" width="146" height="175" rx="65" fill="#558795" stroke="#203e50" stroke-width="7"/><path d="M128 57v70M59 128h138" stroke="#a9d9d3" stroke-width="5"/><circle cx="103" cy="143" r="24" fill="#fff9e8"/><circle cx="157" cy="143" r="24" fill="#fff9e8"/><circle cx="111" cy="146" r="11" fill="#203e50"/><circle cx="150" cy="136" r="12" fill="#203e50"/></svg>')).png().toBuffer();
  let reads = 0;
  await page.route('**:8787/entries', async route => {
    if (delay) await new Promise(resolve => setTimeout(resolve, delay));
    reads++;
    return route.fulfill({ status: (failFirst && reads === 1) || (failSecond && reads === 2) ? 503 : 200, contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ entries: Array.from({ length: count }, (_, index) => ({ ...savedEntry(index), rarity })), unavailableCount: 0 }) });
  });
  const cry = await readFile('assets/pokemon-cries/aipom.mp3');
  await page.route('**:8787/entries/*/*', async route => {
    const audio = route.request().url().endsWith('cry.mp3');
    return route.fulfill({ status: !audio && brokenImage ? 404 : 200, contentType: audio ? 'audio/mpeg' : 'image/png',
      headers: { 'Access-Control-Allow-Origin': '*' }, body: audio ? cry : portrait });
  });
  return { reads: () => reads };
}

test('mountain box opens saved details from a horizontal panel, scans outward, and closes without changing stats', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await mockBox(page);
  await page.addInitScript(() => {
    const frames: { time: number; scaleY: number; left: number; right: number }[] = [];
    const audioPlays: string[] = [];
    Object.assign(window, { entryAnimationFrames: frames, entryAudioPlays: audioPlays });
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      if (this.tagName === 'AUDIO' && !this.loop) this.addEventListener('playing', () => audioPlays.push(this.currentSrc), { once: true });
      return play.call(this);
    };
    const sample = () => {
      const panel = document.querySelector('[data-testid="saved-entry-panel"]');
      const left = document.querySelector('[data-testid="entry-scan-left"]');
      const right = document.querySelector('[data-testid="entry-scan-right"]');
      if (panel && left && right) frames.push({
        time: performance.now(),
        scaleY: new DOMMatrix(getComputedStyle(panel).transform).m22,
        left: new DOMMatrix(getComputedStyle(left).transform).m41,
        right: new DOMMatrix(getComputedStyle(right).transform).m41,
      });
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  await page.goto('/pokedex');
  await expect(page.getByTestId('specimen-tile-12')).toBeAttached();
  await expect(page.getByTestId('specimen-tile-0')).toBeVisible();
  await expect.poll(() => page.locator('[data-testid^="specimen-sprite-"] img').evaluateAll(images =>
    images.filter(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0).length)).toBe(13);
  await page.screenshot({ path: 'output/app-preview/pokedex-mountain-box.png' });
  await page.getByTestId('specimen-tile-0').click();
  await expect(page.getByTestId('saved-entry-panel')).toBeVisible();
  await expect(page.getByTestId('creature-name')).toHaveText('Clickclaw');
  await expect.poll(async () => page.getByTestId('entry-scan-right').evaluate(node => new DOMMatrix(getComputedStyle(node).transform).m41)).toBeGreaterThan(170);
  await expect.poll(() => page.evaluate(() => (window as unknown as { entryAudioPlays: string[] }).entryAudioPlays.length)).toBe(1);
  await expect(page.getByRole('button', { name: 'Close creature details' })).toBeInViewport();
  await page.screenshot({ path: 'output/app-preview/pokedex-saved-portrait.png' });
  await page.getByRole('button', { name: 'Play Cry' }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { entryAudioPlays: string[] }).entryAudioPlays.length)).toBe(2);
  await page.getByRole('button', { name: 'Play Cry' }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { entryAudioPlays: string[] }).entryAudioPlays.length)).toBe(3);
  const sounds = await page.evaluate(() => (window as unknown as { entryAudioPlays: string[] }).entryAudioPlays);
  expect(sounds[0]).not.toBe(sounds[1]);
  expect(sounds[1]).toBe(sounds[2]);
  await page.getByTestId('creature-stats-panel').scrollIntoViewIfNeeded();
  expect((await page.locator('[data-testid^="stat-value-"]').allTextContents()).map(Number)).toEqual(Object.values(stats));
  const frames = await page.evaluate(() => (window as unknown as { entryAnimationFrames: { time: number; scaleY: number; left: number; right: number }[] }).entryAnimationFrames);
  expect(frames.some(frame => frame.scaleY < 0.1)).toBe(true);
  expect(frames.some(frame => frame.scaleY > 0.1 && frame.scaleY < 0.95)).toBe(true);
  expect(frames.filter(frame => frame.scaleY < 0.99).every(frame => frame.left === 0 && frame.right === 0)).toBe(true);
  expect(frames.some(frame => frame.left < -20 && frame.right > 20)).toBe(true);
  const panel = await page.getByTestId('saved-entry-panel').boundingBox();
  const completed = frames.find(frame => frame.right >= panel!.width / 2 - 0.001);
  expect(completed).toBeDefined();
  expect(completed!.time - frames[0].time).toBeGreaterThanOrEqual(1400);
  expect(completed!.time - frames[0].time).toBeLessThan(1750);
  await page.screenshot({ path: 'output/app-preview/pokedex-saved-details.png' });
  const closingFrameStart = await page.evaluate(() => (window as unknown as { entryAnimationFrames: unknown[] }).entryAnimationFrames.length);
  await page.getByRole('button', { name: 'Close creature details' }).click();
  await expect(page.getByTestId('saved-entry-modal')).toHaveCount(0);
  const closingFrames = await page.evaluate(start => (window as unknown as {
    entryAnimationFrames: { time: number; scaleY: number; left: number; right: number }[];
  }).entryAnimationFrames.slice(start), closingFrameStart);
  expect(closingFrames.some(frame => frame.scaleY > 0.999 && frame.right > 0 && frame.right < 170)).toBe(true);
  const collapsing = closingFrames.filter(frame => frame.scaleY < 0.99);
  expect(collapsing.length).toBeGreaterThan(0);
  expect(collapsing.every(frame => Math.abs(frame.right) < 0.01 && Math.abs(frame.left) < 0.01)).toBe(true);
  expect(closingFrames.at(-1)!.scaleY).toBeCloseTo(0.025, 3);
  expect(closingFrames.at(-1)!.time - closingFrames[0].time).toBeGreaterThanOrEqual(1400);
  expect(closingFrames.at(-1)!.time - closingFrames[0].time).toBeLessThan(1750);
  await expect(page.getByTestId('specimen-tile-0')).toBeVisible();
  await page.getByTestId('specimen-tile-0').click();
  await page.getByTestId('creature-stats-panel').scrollIntoViewIfNeeded();
  await expect.poll(() => page.evaluate(() => (window as unknown as { entryAudioPlays: string[] }).entryAudioPlays.length)).toBe(4);
  expect((await page.locator('[data-testid^="stat-value-"]').allTextContents()).map(Number)).toEqual(Object.values(stats));
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('saved-entry-modal')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('a failed refresh preserves the loaded collection and the next refresh recovers', async ({ page }) => {
  await mockBox(page, { count: 1, failSecond: true });
  await page.goto('/pokedex');
  await expect(page.getByTestId('specimen-tile-0')).toBeVisible();
  await page.getByRole('button', { name: 'Open sidebar' }).click();
  await page.getByRole('button', { name: 'Refresh Pokédex' }).click();
  await expect(page.getByText(/Your last loaded collection is still here/)).toBeVisible();
  await expect(page.getByTestId('specimen-tile-0')).toBeVisible();
  await page.getByRole('button', { name: 'Open sidebar' }).click();
  await page.getByRole('button', { name: 'Refresh Pokédex' }).click();
  await expect(page.getByText(/Your last loaded collection is still here/)).toHaveCount(0);
  await expect(page.getByTestId('specimen-tile-0')).toBeVisible();
});

test('empty, loading and failed collections have distinct states and retry recovers', async ({ page }) => {
  await mockBox(page, { count: 0, failFirst: true, delay: 250 });
  await page.goto('/pokedex');
  await expect(page.getByText('Reading your Pokédex…')).toBeVisible();
  await expect(page.getByTestId('pokedex-empty')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'RETRY CONNECTION' })).toBeVisible();
  await page.getByRole('button', { name: 'RETRY CONNECTION' }).click();
  await expect(page.getByRole('button', { name: 'RETRY CONNECTION' })).toHaveCount(0);
  await expect(page.getByText(/Your mountain is waiting|A NEW HOME FOR YOUR DISCOVERIES|Capture a creature and it will find a home here/)).toHaveCount(0);
  await expect(page.getByTestId('specimen-tile-0')).toHaveCount(0);
  await expect(page.getByTestId('empty-slot-0')).toBeVisible();
  await page.getByRole('button', { name: 'Open sidebar' }).click();
  await expect(page.getByRole('button', { name: 'Back to camera' })).toBeInViewport();
});

test('one box scrolls beyond 30 creatures, fits a small phone, and reduced motion skips the scan', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockBox(page, { count: 42 });
  await page.goto('/pokedex');
  await expect(page.getByTestId('specimen-tile-0')).toBeVisible();
  await page.getByTestId('specimen-grid').evaluate(node => { node.scrollTop = node.scrollHeight; });
  await expect(page.getByTestId('specimen-tile-41')).toBeVisible();
  const tile = await page.getByTestId('specimen-tile-41').boundingBox();
  expect(tile!.width).toBeGreaterThanOrEqual(48);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.getByTestId('specimen-tile-41').click();
  await expect(page.getByTestId('creature-name')).toHaveText('Ridge Companion 42');
  await expect(page.getByTestId('entry-scan-left')).toHaveCount(0);
  await expect(page.getByTestId('saved-entry-panel')).toHaveCSS('transform', 'none');
  await page.getByTestId('creature-stats-panel').scrollIntoViewIfNeeded();
  await expect(page.getByRole('button', { name: 'Close creature details' })).toBeInViewport();
  await page.screenshot({ path: 'output/app-preview/pokedex-small-phone.png' });
  await page.getByRole('button', { name: 'Close creature details' }).click();
  await expect(page.getByTestId('specimen-tile-41')).toBeVisible();
});

test('a missing thumbnail retains an inspectable tile and camera navigation reaches the box', async ({ page }) => {
  await mockBox(page, { count: 1, brokenImage: true });
  await page.goto('/');
  await page.getByRole('button', { name: 'View saved Pokédex' }).click();
  await expect(page).toHaveURL(/\/pokedex$/);
  await expect(page.getByTestId('specimen-tile-0')).toContainText('?');
  await page.getByTestId('specimen-tile-0').click();
  await expect(page.getByTestId('creature-name')).toHaveText('Clickclaw');
  await page.getByRole('button', { name: 'Close creature details' }).click();
  await page.getByRole('button', { name: 'Open sidebar' }).click();
  await page.getByRole('button', { name: 'Back to camera' }).click();
  await expect(page.getByRole('button', { name: 'Capture photo' })).toBeVisible();
});

test('saved creatures are accessible when camera permission is denied', async ({ page, context }) => {
  const cdp = await context.newCDPSession(page);
  const { targetInfo } = await cdp.send('Target.getTargetInfo');
  await cdp.send('Browser.setPermission', { permission: { name: 'camera' }, setting: 'denied',
    origin: 'http://localhost:8081', browserContextId: targetInfo.browserContextId });
  await mockBox(page, { count: 1 });
  await page.goto('/');
  await expect(page.getByText('Camera access denied')).toBeVisible();
  await page.getByRole('button', { name: 'View saved Pokédex' }).click();
  await expect(page.getByTestId('specimen-tile-0')).toBeVisible();
});

for (const [rarity, label, color] of [
  [undefined, 'COMMON', 'rgb(209, 213, 219)'],
  ['common', 'COMMON', 'rgb(209, 213, 219)'],
  ['rare', 'RARE', 'rgb(186, 230, 253)'],
  ['legendary', 'LEGENDARY', 'rgb(254, 240, 138)'],
  ['mythical', 'MYTHICAL', 'rgb(147, 51, 234)'],
] as const) {
  test(`saved rarity ${rarity ?? 'legacy fallback'} appears after type on a small phone`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await mockBox(page, { count: 1, rarity });
    await page.goto('/pokedex');
    await page.getByTestId('specimen-tile-0').click();
    const badge = page.getByTestId('creature-rarity');
    await badge.scrollIntoViewIfNeeded();
    await expect(badge).toBeInViewport();
    await expect(badge).toHaveText(label);
    await expect(badge).toHaveCSS('background-color', color);
    if (rarity === 'mythical') await page.screenshot({ path: 'output/app-preview/creature-rarity-small.png' });
    const labels = await page.getByTestId('creature-info-panel').innerText();
    expect(labels.indexOf('Type')).toBeLessThan(labels.indexOf('Rarity'));
    expect(labels.indexOf('Rarity')).toBeLessThan(labels.indexOf('Height'));
    await page.getByRole('button', { name: 'Close creature details' }).click();
    await expect(page.getByTestId('saved-entry-modal')).toHaveCount(0);
  });
}

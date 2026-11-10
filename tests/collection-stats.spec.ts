import { expect, test, type Page } from '@playwright/test';
import sharp from 'sharp';

const rarities = [undefined, 'common', 'rare', 'rare', 'rare', ...Array(13).fill('legendary'), 'mythical'];
function entries(values: (string | undefined)[]) {
  return values.map((rarity, index) => ({
    id: `2026-11-11T12-30-00.${String(index).padStart(3, '0')}Z`, name: `Creature ${index + 1}`,
    description: 'A curious little companion.', object: 'creature', rarity, cry: 'aipom',
    stats: { health: 74, attack: 126, defense: 102, speed: 91, specialDefense: 118, specialAttack: 135 },
  }));
}

async function mockCollection(page: Page, values = rarities, options: { failFirst?: boolean; delay?: number } = {}) {
  let reads = 0;
  await page.route('**:8787/entries', async route => {
    reads++;
    if (options.delay) await new Promise(resolve => setTimeout(resolve, options.delay));
    return route.fulfill({ status: options.failFirst && reads === 1 ? 503 : 200,
      json: { entries: entries(values), unavailableCount: 0 }, headers: { 'Access-Control-Allow-Origin': '*' } });
  });
  const photo = await sharp({ create: { width: 120, height: 160, channels: 3, background: '#edaa77' } }).png().toBuffer();
  await page.route('**:8787/entries/*/*', route => route.fulfill({ contentType: 'image/png', body: photo, headers: { 'Access-Control-Allow-Origin': '*' } }));
  return photo;
}

type Frame = { time: number; panelScale: number; scan: number; x: number; y: number; stamps: { opacity: number; scale: number }[] };
declare global { interface Window { statsFrames: Frame[]; statsSounds: string[]; statsThumps: number[]; statsThumpEnds: number[] } }

test('stats shows the saved trainer, stamps real rarity totals, and recoils at each impact', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const photo = await mockCollection(page);
  await page.addInitScript(profile => {
    localStorage.setItem('rotom-dex-profile', JSON.stringify(profile));
    window.statsFrames = [];
    window.statsSounds = [];
    window.statsThumps = [];
    window.statsThumpEnds = [];
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      if (this.tagName === 'AUDIO' && !this.loop) this.addEventListener('playing', () => {
        window.statsSounds.push(this.currentSrc);
        if (Math.abs(this.duration - 0.984) < 0.015) {
          window.statsThumps.push(performance.now());
          this.addEventListener('ended', () => window.statsThumpEnds.push(performance.now()), { once: true });
        }
      }, { once: true });
      return play.call(this);
    };
    const sample = () => {
      const panel = document.querySelector('[data-testid="collection-stats-panel"]');
      const frame = document.querySelector('[data-testid="stats-impact-frame"]');
      const scan = document.querySelector('[data-testid="stats-scan-right"]');
      if (panel && frame && scan) {
        const motion = new DOMMatrix(getComputedStyle(frame).transform);
        window.statsFrames.push({ time: performance.now(), panelScale: new DOMMatrix(getComputedStyle(panel).transform).m22,
          scan: new DOMMatrix(getComputedStyle(scan).transform).m41, x: motion.m41, y: motion.m42,
          stamps: ['total', 'common', 'rare', 'legendary', 'mythical'].map(key => {
            const stamp = document.querySelector(`[data-testid="collection-stamp-${key}"]`);
            const style = stamp ? getComputedStyle(stamp) : null;
            const matrix = new DOMMatrix(style?.transform);
            return { opacity: Number(style?.opacity ?? 0), scale: Math.hypot(matrix.a, matrix.b) };
          }),
        });
      }
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  }, { name: 'Ash Ketchum', photoUri: `data:image/png;base64,${photo.toString('base64')}` });
  await page.goto('/pokedex');
  await page.getByRole('button', { name: 'Open sidebar' }).click();
  await page.getByRole('button', { name: 'Stats', exact: true }).click();
  await expect(page.getByTestId('stats-profile-name')).toHaveText('Ash Ketchum');
  await expect(page.getByTestId('stats-profile-photo')).toBeVisible();
  for (const [key, label, count] of [['total', 'COLLECTED', 19], ['common', 'COMMON', 2], ['rare', 'RARE', 3], ['legendary', 'LEGENDARY', 13], ['mythical', 'MYTHICAL', 1]]) {
    await expect(page.getByTestId(`collection-stamp-${key}`)).toHaveText(`${label}: ${count}`);
  }
  await expect.poll(() => page.getByTestId('collection-stamp-mythical').evaluate(node => {
    const style = getComputedStyle(node);
    const matrix = new DOMMatrix(style.transform);
    return Number(style.opacity) === 1 && Math.abs(Math.hypot(matrix.a, matrix.b) - 1) < 0.001;
  })).toBe(true);
  await expect(page.getByTestId('collection-stamp-legendary')).toHaveCSS('background-color', 'rgb(254, 240, 138)');
  const frames = await page.evaluate(() => window.statsFrames);
  expect(frames.some(frame => frame.panelScale < 0.1)).toBe(true);
  expect(frames.some(frame => frame.panelScale > 0.1 && frame.panelScale < 0.95)).toBe(true);
  const first = frames.find(frame => frame.stamps[0].opacity > 0)!;
  expect(first.panelScale).toBeCloseTo(1, 2);
  const panel = await page.getByTestId('collection-stats-panel').boundingBox();
  expect(first.scan).toBeGreaterThan(panel!.width / 2 - 1);
  const arrivals: number[] = [];
  for (let index = 0; index < 5; index++) {
    const arrival = frames.find(frame => frame.stamps[index].opacity > 0)!;
    arrivals.push(arrival.time);
    expect(frames.some(frame => frame.stamps[index].opacity > 0 && frame.stamps[index].scale > 1.2)).toBe(true);
    expect(frames.some(frame => frame.stamps[index].scale < 0.99)).toBe(true);
    expect(frames.some(frame => frame.time > arrival.time + 100 && frame.time < arrival.time + 350 && Math.abs(frame.x) > 2)).toBe(true);
  }
  for (let index = 1; index < 5; index++) expect(arrivals[index] - arrivals[index - 1]).toBeGreaterThan(350);
  await expect.poll(() => page.evaluate(() => window.statsSounds.length)).toBe(6);
  const thumps = await page.evaluate(() => window.statsThumps);
  expect(thumps).toHaveLength(5);
  for (let index = 0; index < 5; index++) {
    expect(thumps[index] - arrivals[index]).toBeGreaterThan(100);
    expect(thumps[index] - arrivals[index]).toBeLessThan(300);
  }
  await expect.poll(() => page.evaluate(() => window.statsThumpEnds.length)).toBe(5);
  await expect.poll(() => page.getByTestId('stats-impact-frame').evaluate(node => new DOMMatrix(getComputedStyle(node).transform).m41)).toBe(0);
  await page.screenshot({ path: 'output/app-preview/collection-stats.png' });
  const beforeClose = frames.length;
  await page.getByRole('button', { name: 'Close stats' }).click();
  await expect(page.getByTestId('collection-stats-modal')).toHaveCount(0);
  const closing = await page.evaluate(start => window.statsFrames.slice(start), beforeClose);
  expect(closing.some(frame => frame.scan > 0 && frame.scan < 170 && frame.panelScale > 0.999)).toBe(true);
  expect(closing.some(frame => frame.panelScale < 0.9 && frame.scan < 0.01)).toBe(true);
  expect(closing.every(frame => Math.abs(frame.x) < 0.01)).toBe(true);
  await expect(page).toHaveURL(/\/pokedex$/);
  expect(await page.evaluate(() => window.statsThumps.length)).toBe(5);
  expect(errors).toEqual([]);
});

test('stats waits for a collection, recovers from failure and handles an empty collection on a small phone', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockCollection(page, [], { failFirst: true, delay: 700 });
  await page.goto('/pokedex/stats');
  await expect(page.getByLabel('Loading collection stats')).toBeVisible();
  await expect(page.getByTestId('collection-stamp-total')).toHaveCount(0);
  await page.getByRole('button', { name: 'Retry collection stats' }).click();
  await expect(page.getByTestId('collection-stamp-total')).toHaveText('COLLECTED: 0');
  await expect(page.getByTestId('stats-profile-name')).toHaveText('Trainer');
  await expect(page.getByTestId('stats-scan-left')).toHaveCount(0);
  await expect(page.getByTestId('collection-stats-panel')).toHaveCSS('transform', 'none');
  await expect(page.getByTestId('collection-stamp-total')).toHaveCSS('transform', 'none');
  expect(await page.getByTestId('stats-impact-frame').evaluate(node => new DOMMatrix(getComputedStyle(node).transform).isIdentity)).toBe(true);
  await page.getByTestId('collection-stamp-mythical').scrollIntoViewIfNeeded();
  await expect(page.getByTestId('collection-stamp-mythical')).toBeInViewport();
  await expect(page.getByTestId('collection-stamp-mythical')).toHaveText('MYTHICAL: 0');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await expect(page.getByRole('button', { name: 'Close stats' })).toBeInViewport();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('collection-stats-modal')).toHaveCount(0);
});

test('a profile read failure leaves collection stats available and retry restores the trainer', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockCollection(page, ['rare']);
  await page.addInitScript(() => localStorage.setItem('rotom-dex-profile', '{broken'));
  await page.goto('/pokedex/stats');
  await expect(page.getByText('Your profile could not be loaded.')).toBeVisible();
  await expect(page.getByTestId('collection-stamp-total')).toHaveText('COLLECTED: 1');
  await expect(page.getByTestId('collection-stamp-total')).toHaveCSS('opacity', '1');
  await page.evaluate(() => localStorage.setItem('rotom-dex-profile', JSON.stringify({ name: 'Brock', photoUri: null })));
  await page.getByRole('button', { name: 'Retry stats profile' }).click();
  await expect(page.getByTestId('stats-profile-name')).toHaveText('Brock');
  await expect(page.getByTestId('collection-stamp-rare')).toHaveText('RARE: 1');
});

test('stats reloads profile and collection changes on each visit and can close during a stamp', async ({ page }) => {
  await mockCollection(page, ['common']);
  await page.goto('/pokedex/stats');
  await expect(page.getByTestId('collection-stamp-total')).toHaveCSS('opacity', '1');
  await page.getByRole('button', { name: 'Close stats' }).click();
  await expect(page.getByTestId('collection-stats-modal')).toHaveCount(0);
  await page.evaluate(() => localStorage.setItem('rotom-dex-profile', JSON.stringify({ name: 'Misty', photoUri: null })));
  await page.route('**:8787/entries', route => route.fulfill({ json: { entries: entries(['rare', 'mythical']), unavailableCount: 0 }, headers: { 'Access-Control-Allow-Origin': '*' } }));
  await page.getByRole('button', { name: 'Open sidebar' }).click();
  await page.getByRole('button', { name: 'Stats', exact: true }).click();
  await expect(page.getByTestId('stats-profile-name')).toHaveText('Misty');
  await expect(page.getByTestId('collection-stamp-total')).toHaveText('COLLECTED: 2');
  await expect(page.getByTestId('collection-stamp-common')).toHaveText('COMMON: 0');
  await expect(page.getByTestId('collection-stamp-rare')).toHaveText('RARE: 1');
  await expect(page.getByTestId('collection-stamp-mythical')).toHaveText('MYTHICAL: 1');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('collection-stats-modal')).toHaveCount(0);
});

test('a saved name containing Sharukh switches the whole Stats page to Hindi and switches back after editing the name', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const photo = await mockCollection(page);
  await page.addInitScript(profile => localStorage.setItem('rotom-dex-profile', JSON.stringify(profile)), {
    name: 'Md. sHaRuKh Khan', photoUri: `data:image/png;base64,${photo.toString('base64')}`,
  });
  await page.goto('/pokedex/stats');
  await expect(page.getByRole('heading', { name: 'आँकड़े', exact: true })).toBeVisible();
  await expect(page.getByTestId('stats-profile-name')).toHaveText('Md. sHaRuKh Khan');
  await expect(page.getByRole('img', { name: 'आपकी प्रोफ़ाइल तस्वीर' })).toBeVisible();
  for (const [key, text] of [['total', 'एकत्रित जीव: १९'], ['common', 'सामान्य: २'], ['rare', 'दुर्लभ: ३'], ['legendary', 'पौराणिक: १३'], ['mythical', 'मिथकीय: १']]) {
    await expect(page.getByTestId(`collection-stamp-${key}`)).toHaveText(text);
    await expect(page.getByTestId(`collection-stamp-${key}`)).toHaveAttribute('aria-label', text);
  }
  await expect.poll(() => page.evaluate(() => document.fonts.check('16px PokedexHindi', 'आँकड़े'))).toBe(true);
  await expect(page.getByTestId('collection-stamp-mythical')).toHaveCSS('opacity', '1');
  await page.screenshot({ path: 'output/app-preview/collection-stats-hindi.png' });
  await page.getByRole('button', { name: 'आँकड़े बंद करें' }).click();
  await expect(page.getByTestId('collection-stats-modal')).toHaveCount(0);
  await page.getByRole('button', { name: 'Open sidebar' }).click();
  await page.getByRole('button', { name: 'Profile', exact: true }).click();
  await page.getByRole('textbox', { name: 'NAME', exact: true }).fill('Misty');
  await page.getByRole('button', { name: 'Save profile', exact: true }).click();
  await expect(page.getByText('Profile saved.')).toBeVisible();
  await page.getByRole('button', { name: 'Close profile' }).click();
  await expect(page.getByTestId('profile-modal')).toHaveCount(0);
  await page.getByRole('button', { name: 'Open sidebar' }).click();
  await page.getByRole('button', { name: 'Stats', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'STATS', exact: true })).toBeVisible();
  await expect(page.getByTestId('stats-profile-name')).toHaveText('Misty');
  await expect(page.getByTestId('collection-stamp-legendary')).toHaveText('LEGENDARY: 13');
});

test('Hindi Stats translates loading, connection errors, retry, empty collection and unavailable counts on a small phone', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockCollection(page, [], { failFirst: true, delay: 700 });
  await page.addInitScript(() => localStorage.setItem('rotom-dex-profile', JSON.stringify({ name: 'Sharukh', photoUri: null })));
  await page.goto('/pokedex/stats');
  await expect(page.getByLabel('संग्रह के आँकड़े लोड हो रहे हैं')).toBeVisible();
  await expect(page.getByText('आपका पोकेडेक्स लोड नहीं हो सका। अपने कंप्यूटर से कनेक्शन जाँचें और फिर से कोशिश करें।')).toBeVisible();
  await page.route('**:8787/entries', route => route.fulfill({ json: { entries: [], unavailableCount: 2 }, headers: { 'Access-Control-Allow-Origin': '*' } }));
  await page.getByRole('button', { name: 'संग्रह फिर से लोड करें' }).click();
  await expect(page.getByTestId('collection-stamp-total')).toHaveText('एकत्रित जीव: ०');
  await expect(page.getByText(/आपकी पहली खोज आपका इंतज़ार कर रही है/)).toBeAttached();
  await expect(page.getByText(/२ सहेजी गई प्रविष्टियाँ/)).toBeAttached();
  await page.getByTestId('collection-stamp-mythical').scrollIntoViewIfNeeded();
  await expect(page.getByTestId('collection-stamp-mythical')).toBeInViewport();
  const text = await page.getByTestId('collection-stats-modal').innerText();
  expect(text.replace('Sharukh', '')).not.toMatch(/[A-Za-z]/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

test('Stats rechecks the saved Android-style name when the app returns to the foreground', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockCollection(page, ['legendary', 'mythical']);
  await page.addInitScript(() => localStorage.setItem('rotom-dex-profile', JSON.stringify({ name: 'Misty', photoUri: null })));
  await page.goto('/pokedex/stats');
  await expect(page.getByRole('heading', { name: 'STATS', exact: true })).toBeVisible();
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
    localStorage.setItem('rotom-dex-profile', JSON.stringify({ name: 'Sha\u200Brukh', photoUri: null }));
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.getByRole('heading', { name: 'आँकड़े', exact: true })).toBeVisible();
  await expect(page.getByTestId('collection-stamp-legendary')).toHaveText('पौराणिक: १');
  await expect(page.getByTestId('collection-stamp-mythical')).toHaveText('मिथकीय: १');
});

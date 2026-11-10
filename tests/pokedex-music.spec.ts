import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

declare global { interface Window { pokedexMusicTracks: HTMLMediaElement[]; pokedexMusicStarts: number } }

test('Pokédex music loops continuously across menus, pauses in the background, and stops at the camera', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**:8787/entries', route => route.fulfill({ json: { entries: [{
    id: '2026-11-11T12-30-00.000Z', name: 'Clickclaw', description: 'A little companion.', cry: 'aipom',
    stats: { health: 74, attack: 126, defense: 102, speed: 91, specialDefense: 118, specialAttack: 135 },
  }], unavailableCount: 0 }, headers: { 'Access-Control-Allow-Origin': '*' } }));
  const cry = await readFile('assets/pokemon-cries/aipom.mp3');
  const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
  await page.route('**:8787/entries/*/*', route => route.fulfill({ contentType: route.request().url().endsWith('cry.mp3') ? 'audio/mpeg' : 'image/png',
    body: route.request().url().endsWith('cry.mp3') ? cry : pixel, headers: { 'Access-Control-Allow-Origin': '*' } }));
  await page.addInitScript(() => {
    window.pokedexMusicTracks = [];
    window.pokedexMusicStarts = 0;
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      if (this.tagName === 'AUDIO' && this.loop) {
        if (!window.pokedexMusicTracks.includes(this)) window.pokedexMusicTracks.push(this);
        window.pokedexMusicStarts++;
      }
      return play.call(this);
    };
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Capture photo' })).toBeEnabled();
  expect(await page.evaluate(() => window.pokedexMusicTracks.length)).toBe(0);
  await page.getByRole('button', { name: 'View saved Pokédex' }).click();
  await expect.poll(() => page.evaluate(() => window.pokedexMusicTracks.length)).toBe(1);
  await expect.poll(() => page.evaluate(() => !window.pokedexMusicTracks[0].paused && window.pokedexMusicTracks[0].currentTime > 0.1)).toBe(true);
  expect(await page.evaluate(() => window.pokedexMusicTracks[0].volume)).toBeCloseTo(0.3);
  for (const name of ['Profile', 'Stats']) {
    await page.getByRole('button', { name: 'Open sidebar' }).click();
    await page.getByRole('button', { name, exact: true }).click();
    await page.getByRole('button', { name: `Close ${name.toLowerCase()}`, exact: true }).click();
    await expect(page).toHaveURL(/\/pokedex$/);
  }
  await page.getByTestId('specimen-tile-0').click();
  await page.getByRole('button', { name: 'Play Cry' }).click();
  expect(await page.evaluate(() => !window.pokedexMusicTracks[0].paused)).toBe(true);
  await page.getByRole('button', { name: 'Close creature details' }).click();
  await expect(page).toHaveURL(/\/pokedex$/);
  expect(await page.evaluate(() => window.pokedexMusicTracks.length)).toBe(1);
  expect(await page.evaluate(() => window.pokedexMusicStarts)).toBe(1);

  const position = await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
    return window.pokedexMusicTracks[0].currentTime;
  });
  await expect.poll(() => page.evaluate(() => window.pokedexMusicTracks[0].paused)).toBe(true);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(() => page.evaluate(() => !window.pokedexMusicTracks[0].paused)).toBe(true);
  expect(await page.evaluate(() => window.pokedexMusicTracks[0].currentTime)).toBeGreaterThanOrEqual(position);
  await page.evaluate(() => { const track = window.pokedexMusicTracks[0]; track.currentTime = track.duration - 0.15; });
  await expect.poll(() => page.evaluate(() => window.pokedexMusicTracks[0].currentTime < 2 && !window.pokedexMusicTracks[0].paused)).toBe(true);
  await page.getByRole('button', { name: 'Open sidebar' }).click();
  await page.getByRole('button', { name: 'Back to camera' }).click();
  await expect(page.getByRole('button', { name: 'Capture photo' })).toBeVisible();
  expect(await page.evaluate(() => window.pokedexMusicTracks.every(track => track.paused))).toBe(true);
  expect(errors).toEqual([]);
});

test('leaving the Pokédex before the music loads cannot start music on the camera', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**:8787/entries', route => route.fulfill({ json: { entries: [], unavailableCount: 0 }, headers: { 'Access-Control-Allow-Origin': '*' } }));
  const music = await readFile('assets/background-music-pokedex.mp3');
  let finishLoad: (() => void) | undefined;
  await page.route(/background-music-pokedex/, async route => {
    await new Promise<void>(resolve => { finishLoad = resolve; });
    await route.fulfill({ contentType: 'audio/mpeg', body: music });
  });
  await page.addInitScript(() => {
    window.pokedexMusicStarts = 0;
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      if (this.tagName === 'AUDIO' && this.loop) window.pokedexMusicStarts++;
      return play.call(this);
    };
  });
  await page.goto('/pokedex', { waitUntil: 'domcontentloaded' });
  await expect.poll(() => !!finishLoad).toBe(true);
  await page.getByRole('button', { name: 'Open sidebar' }).click();
  await page.getByRole('button', { name: 'Back to camera' }).click();
  await expect(page).toHaveURL(/\/$/);
  const loaded = page.waitForResponse(response => response.url().includes('background-music-pokedex'));
  finishLoad!();
  await loaded;
  await expect(page.getByRole('button', { name: 'Capture photo' })).toBeEnabled();
  expect(await page.evaluate(() => window.pokedexMusicStarts)).toBe(0);
});

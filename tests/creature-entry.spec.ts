import { expect, test, type Page } from '@playwright/test';
import sharp from 'sharp';

const NAME = 'Clickclaw';
const DESCRIPTION = 'A curious desk companion that chases stray clicks with its cable tail and greets every discovery with a wiggly grin.';

async function trackCaughtAudio(page: Page) {
  await page.addInitScript(() => {
    const events: { entryVisible: boolean; revealVisible: boolean }[] = [];
    const flashes: { time: number }[] = [];
    const cries: { time: number; source: string; announcement: boolean }[] = [];
    Object.assign(window, { caughtSoundEvents: events, flashSoundEvents: flashes, crySoundEvents: cries });
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      if (this.tagName === 'AUDIO') {
        this.addEventListener('playing', () => {
          // Preloaded expo-audio assets use blob URLs. Identify this 4.42-second
          // clip by its decoded duration rather than the original filename.
          if (this.duration > 4.3 && this.duration < 4.6) events.push({
            entryVisible: !!document.querySelector('[data-testid="creature-entry"]'),
            revealVisible: !!document.querySelector('[data-testid="creature-reveal"]'),
          });
          if (this.duration < 1.56 && !document.querySelector('[data-testid="pokedex-curtains"]') && document.querySelector('[data-testid="creature-reveal"], [data-testid="creature-entry"]')) cries.push({
            time: performance.now(), source: this.currentSrc,
            announcement: !!document.querySelector('[data-testid="capture-announcement"]'),
          });
          if (this.duration > 2 && this.duration < 2.25) flashes.push({ time: performance.now() });
        }, { once: true });
      }
      return play.call(this);
    };
  });
}

const caughtAudio = (page: Page) => page.evaluate(() => (window as unknown as { caughtSoundEvents: { entryVisible: boolean; revealVisible: boolean }[] }).caughtSoundEvents);

async function openEntry(page: Page) {
  const open = page.getByRole('button', { name: /Open Pokédex entry/ });
  await expect(open).toBeEnabled({ timeout: 10000 });
  await open.click();
  await expect(page.getByTestId('pokedex-curtains')).toHaveCount(0);
}

async function mockCreature(page: Page, { brokenPortrait = false, corruptPortrait = false, longText = false, generationGate = Promise.resolve() } = {}) {
  const portrait = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="768" height="768" viewBox="0 0 768 768">
    <path d="M380 180 Q340 130 380 40" fill="none" stroke="#33424b" stroke-width="14"/>
    <path d="M240 280 Q240 170 384 170 Q528 170 528 280 L514 568 Q510 666 384 666 Q258 666 254 568Z" fill="#334d5a" stroke="#19282e" stroke-width="10"/>
    <path d="M384 180V320 M250 335Q384 375 518 335" stroke="#6d909d" stroke-width="6" fill="none"/>
    <ellipse cx="343" cy="360" rx="42" ry="47" fill="#fffdf5" stroke="#14232b" stroke-width="5"/>
    <ellipse cx="430" cy="352" rx="44" ry="49" fill="#fffdf5" stroke="#14232b" stroke-width="5"/>
    <circle cx="355" cy="370" r="23" fill="#14232b"/><circle cx="419" cy="340" r="24" fill="#14232b"/>
    <path d="M330 446L345 465L360 446L375 465L390 446L405 465L420 446L435 465L450 446" fill="none" stroke="#fff" stroke-width="11" stroke-linejoin="round" stroke-linecap="round"/>
  </svg>`)).png().toBuffer();
  let uploadAuthorization: string | undefined;
  await page.route('**:8787/photos/**', async (route) => {
    if (route.request().method() === 'GET') {
      expect(route.request().headers().authorization).toBe(uploadAuthorization);
      return route.fulfill({ status: brokenPortrait ? 503 : 200, contentType: 'image/png', headers: { 'Access-Control-Allow-Origin': '*' }, body: corruptPortrait ? Buffer.from('invalid image') : portrait });
    }
    if (route.request().method() !== 'PUT') return route.continue();
    await generationGate;
    uploadAuthorization = route.request().headers().authorization;
    const name = route.request().url().split('/').at(-1)!;
    const result = { status: 'recognized', label: 'computer mouse', creature: {
      name: longText ? 'Clickclaw Extraordinary Desk Guardian' : NAME,
      description: longText ? `${DESCRIPTION} It guards every notebook and pencil, collecting tiny adventures and befriending anyone who stops by the desk.` : DESCRIPTION,
      imageName: name.replace('.png', '.creature.png'),
      style: 'dex-v2', element: 'Electric', rarity: 'rare', heightCm: 12, weightKg: 0.15, category: 'The Desk Companion', eyebrow: 'one raised and one flat, looking skeptical',
      // Match a completed photo-server archive, including its saved gameplay.
      stats: { health: 70, attack: 140, defense: 105, speed: 87, specialDefense: 123, specialAttack: 77 },
      cry: 'aipom',
    } };
    return route.fulfill({ status: 201, contentType: 'image/png', body: portrait, headers: {
      'Access-Control-Allow-Origin': '*', 'Access-Control-Expose-Headers': 'X-Object-Recognition',
      'X-Object-Recognition': encodeURIComponent(JSON.stringify(result)),
    } });
  });
}

test('capture holds white for one second, celebrates in the spotlight, then opens the entry on tap', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await trackCaughtAudio(page);
  let releaseGeneration!: () => void;
  const generationGate = new Promise<void>((resolve) => { releaseGeneration = resolve; });
  await mockCreature(page, { generationGate });
  await page.goto('/');
  await page.getByRole('button', { name: 'Capture photo' }).click();
  await expect(page.getByTestId('capture-scene-dim')).toHaveCSS('opacity', '0.22');
  await expect(page.getByTestId('creature-reveal')).toHaveCount(0);
  await expect(page.getByTestId('creature-entry')).toHaveCount(0);
  releaseGeneration();
  const flash = page.getByTestId('creature-radial-flash');
  await expect(flash).toBeAttached({ timeout: 10000 });
  await page.evaluate(() => {
    const frames: { time: number; width: number; opacity: number; announcement: boolean }[] = [];
    Object.assign(window, { radialFrames: frames });
    const until = performance.now() + 4500;
    const sample = () => {
      const flash = document.querySelector('[data-testid="creature-radial-flash"]');
      if (flash) frames.push({ time: performance.now(), width: flash.getBoundingClientRect().width,
        opacity: Number(getComputedStyle(flash).opacity), announcement: !!document.querySelector('[data-testid="capture-announcement"]') });
      if (performance.now() < until) requestAnimationFrame(sample);
    };
    sample();
  });
  await expect(page.getByTestId('creature-entry')).toHaveCount(0);
  await expect(page.getByTestId('creature-reveal-scene')).toHaveCSS('opacity', '1');
  await expect(page.getByTestId('recognition-celebration')).toHaveCount(0);
  await expect(page.getByTestId('capture-textbox')).toHaveCount(0);
  await expect(page.getByTestId('open-pokedex')).toBeDisabled();
  await expect(page.getByTestId('creature-reveal-portrait')).toHaveCSS('opacity', '1');
  await expect(flash).toHaveCSS('opacity', '0');
  const frames = await page.evaluate(() => (window as unknown as { radialFrames: { time: number; width: number; opacity: number }[] }).radialFrames);
  expect(frames.some((frame) => frame.width > 64 && frame.width < 500 && frame.opacity === 1)).toBe(true);
  expect(frames.some((frame) => frame.width > 844 && frame.opacity > 0)).toBe(true);
  const fullWidth = Math.max(...frames.map((frame) => frame.width));
  const whiteHold = frames.filter((frame) => frame.width === fullWidth && frame.opacity === 1);
  // Allow a frame at each end of the one-second plateau for browser sampling.
  const heldFor = whiteHold.at(-1)!.time - whiteHold[0].time;
  expect(heldFor).toBeGreaterThanOrEqual(950);
  expect(heldFor).toBeLessThanOrEqual(1050);
  const flashSounds = await page.evaluate(() => (window as unknown as { flashSoundEvents: { time: number }[] }).flashSoundEvents);
  expect(flashSounds).toHaveLength(1);
  const firstFlash = frames.find(frame => frame.opacity > 0)!;
  expect(Math.abs(flashSounds[0].time - firstFlash.time)).toBeLessThan(180);
  await expect(page.getByTestId('creature-spotlight')).toBeVisible();
  await expect(page.getByTestId('recognition-celebration')).toBeVisible();
  await expect(page.locator('[data-testid^="recognition-star-"]')).not.toHaveCount(0);
  await expect(page.locator('[data-testid^="recognition-confetti-"]')).not.toHaveCount(0);
  await expect(page.getByRole('button', { name: /Retake photo|Take picture of new creature/ })).toHaveCount(0);
  await expect.poll(() => caughtAudio(page)).toEqual([{ entryVisible: false, revealVisible: true }]);
  await page.waitForTimeout(1300);
  await expect(page.getByTestId('capture-announcement')).toHaveText(`${NAME} Has Been Captured!`);
  await expect.poll(() => page.evaluate(() => (window as unknown as { radialFrames: { announcement: boolean }[] }).radialFrames.some(frame => frame.announcement))).toBe(true);
  const timing = await page.evaluate(() => {
    const frames = (window as unknown as { radialFrames: { time: number; opacity: number; announcement: boolean }[] }).radialFrames;
    const flashEnd = frames.find((frame, index) => index > 0 && frame.opacity === 0 && frames[index - 1].opacity > 0)!;
    return frames.find(frame => frame.announcement)!.time - flashEnd.time;
  });
  expect(timing).toBeGreaterThanOrEqual(1200);
  expect(timing).toBeLessThanOrEqual(1450);
  const cryEvents = await page.evaluate(() => (window as unknown as { crySoundEvents: { time: number; source: string; announcement: boolean }[] }).crySoundEvents);
  expect(cryEvents).toHaveLength(1);
  expect(cryEvents[0].announcement).toBe(false);
  const flashEndTime = await page.evaluate(() => {
    const frames = (window as unknown as { radialFrames: { time: number; opacity: number }[] }).radialFrames;
    return frames.find((frame, index) => index > 0 && frame.opacity === 0 && frames[index - 1].opacity > 0)!.time;
  });
  expect(cryEvents[0].time - flashEndTime).toBeGreaterThanOrEqual(650);
  expect(cryEvents[0].time - flashEndTime).toBeLessThanOrEqual(900);
  await page.screenshot({ path: 'output/app-preview/creature-spotlight.png' });
  await expect(page.getByTestId('creature-entry')).toHaveCount(0);
  await openEntry(page);
  await expect(page.getByTestId('creature-name')).toContainText(NAME, { timeout: 10000 });
  await page.getByRole('button', { name: 'Play Cry', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { crySoundEvents: unknown[] }).crySoundEvents.length)).toBe(2);
  const replaySource = await page.evaluate(() => (window as unknown as { crySoundEvents: { source: string }[] }).crySoundEvents[1].source);
  expect(replaySource).toBe(cryEvents[0].source);
  await expect(page.getByTestId('creature-name')).toHaveCSS('font-family', 'PokedexPixel');
  await expect(page.getByTestId('creature-name')).toHaveCSS('text-align', 'center');
  await expect(page.getByRole('button', { name: 'Take picture of new creature' })).toHaveText('TAKE PICTURE OF NEW CREATURE');
  await expect(page.getByTestId('creature-description')).toHaveText(DESCRIPTION);
  await expect(page.getByTestId('creature-portrait')).toBeVisible();
  await expect(page.getByTestId('captured-photo')).toHaveCount(0);
  await expect(page.getByTestId('recognition-celebration')).toHaveCount(0);
  await expect(page.getByTestId('rotom-capture-frame')).toHaveCount(0);
  await expect(page.getByTestId('capture-edge-loader')).toHaveCount(0);
  await expect(page.getByTestId('capture-flash')).toHaveCount(0);
  await expect(page.getByTestId('capture-ball')).toHaveCount(0);
  await expect(page.getByText('ELECTRIC', { exact: true })).toBeVisible();
  await expect(page.getByTestId('creature-rarity')).toHaveText('RARE');
  await expect(page.getByTestId('creature-rarity')).toHaveCSS('background-color', 'rgb(186, 230, 253)');
  await expect(page.getByText('Height', { exact: true })).toBeVisible();
  await expect(page.getByText('Weight', { exact: true })).toBeVisible();
  await expect(page.getByText('≈ 12 cm', { exact: true })).toBeVisible();
  await expect(page.getByText('≈ 0.15 kg', { exact: true })).toBeVisible();
  await expect(page.getByText(/^(POKÉDEX|REAL LIFE|A LITTLE STRANGE. VERY REAL.|Object|Mood)$/)).toHaveCount(0);
  await expect(page.getByTestId('creature-display')).toHaveCSS('opacity', '1');
  await expect(page.getByTestId('entry-reveal-glow')).toHaveCSS('opacity', '0');
  const imageBox = await page.getByTestId('creature-image-panel').boundingBox();
  const infoBox = await page.getByTestId('creature-info-panel').boundingBox();
  expect(infoBox!.y).toBeGreaterThanOrEqual(imageBox!.y + imageBox!.height);
  await expect(page.getByText(/ULTRA RARE|BASIC|HP 680/)).toHaveCount(0);
  await expect.poll(() => caughtAudio(page)).toEqual([{ entryVisible: false, revealVisible: true }]);
  await expect(page.getByRole('button', { name: /Retake photo|Take picture of new creature/ })).toBeEnabled();
  await expect(page.getByTestId('recognition-celebration')).toHaveCount(0);
  await page.screenshot({ path: 'output/app-preview/creature-entry.png' });
  await page.getByRole('button', { name: /Retake photo|Take picture of new creature/ }).click();
  await expect(page.getByTestId('creature-entry')).toHaveCount(0);
  await expect(page.getByTestId('back-camera')).toBeVisible();
  await page.getByRole('button', { name: 'Capture photo' }).click();
  await expect.poll(() => caughtAudio(page)).toHaveLength(2);
  await openEntry(page);
  await expect(page.getByTestId('creature-name')).toContainText(NAME);
  await expect.poll(() => caughtAudio(page)).toEqual([{ entryVisible: false, revealVisible: true }, { entryVisible: false, revealVisible: true }]);
  expect(errors).toEqual([]);
});

test('portrait download failure keeps the saved cutout and allows another capture', async ({ page }) => {
  await trackCaughtAudio(page);
  await mockCreature(page, { brokenPortrait: true });
  await page.goto('/');
  await page.getByRole('button', { name: 'Capture photo' }).click();
  await expect(page.getByText('Photo saved. Creature unavailable. Try again later.')).toBeVisible({ timeout: 10000 });
  await expect(page.getByTestId('captured-photo')).toBeVisible();
  await expect(page.getByTestId('creature-entry')).toHaveCount(0);
  await expect(page.getByTestId('creature-reveal')).toHaveCount(0);
  await expect(page.getByTestId('recognition-celebration')).toHaveCount(0);
  expect(await caughtAudio(page)).toEqual([]);
  await page.getByRole('button', { name: /Retake photo|Take picture of new creature/ }).click();
  await expect(page.getByTestId('back-camera')).toBeVisible();
});

test('curtains swing from the top, mount the entry only while covered, and reopen', async ({ page }) => {
  await mockCreature(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Capture photo' }).click();
  const open = page.getByRole('button', { name: /Open Pokédex entry/ });
  await expect(open).toBeEnabled({ timeout: 10000 });
  await page.evaluate(() => {
    const frames: { entry: boolean; left: number; right: number }[] = [];
    Object.assign(window, { curtainFrames: frames });
    const until = performance.now() + 3500;
    const sample = () => {
      const left = document.querySelector('[data-testid="pokedex-curtain-left"]');
      const right = document.querySelector('[data-testid="pokedex-curtain-right"]');
      if (left && right) {
        const angle = (element: Element) => {
          const matrix = new DOMMatrix(getComputedStyle(element).transform);
          return Math.atan2(matrix.b, matrix.a) * 180 / Math.PI;
        };
        frames.push({ entry: !!document.querySelector('[data-testid="creature-entry"]'), left: angle(left), right: angle(right) });
      }
      if (performance.now() < until) requestAnimationFrame(sample);
    };
    sample();
  });
  await open.click();
  await expect(page.getByTestId('pokedex-curtains')).toBeVisible();
  await expect(page.getByTestId('creature-entry')).toBeAttached();
  await expect(page.getByTestId('pokedex-curtain-left')).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');
  await expect(page.getByTestId('pokedex-curtain-right')).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');
  await page.screenshot({ path: 'output/app-preview/pokedex-curtains-closed.png' });
  await expect(page.getByRole('button', { name: /Retake photo|Take picture of new creature/ })).toHaveCount(0);
  await expect(page.getByTestId('pokedex-curtains')).toHaveCount(0);
  const frames = await page.evaluate(() => (window as unknown as { curtainFrames: { entry: boolean; left: number; right: number }[] }).curtainFrames);
  expect(frames.some(frame => !frame.entry && frame.left > 5 && frame.left < 85 && frame.right < -5)).toBe(true);
  const firstEntry = frames.find(frame => frame.entry)!;
  expect(Math.abs(firstEntry.left)).toBeLessThan(0.1);
  expect(Math.abs(firstEntry.right)).toBeLessThan(0.1);
  expect(frames.some(frame => frame.entry && frame.left > 5 && frame.left < 85 && frame.right < -5)).toBe(true);
  await expect(page.getByRole('button', { name: /Retake photo|Take picture of new creature/ })).toBeEnabled();
});

test('an undecodable portrait returns to the capture instead of trapping the reveal', async ({ page }) => {
  await mockCreature(page, { corruptPortrait: true });
  await page.goto('/');
  await page.getByRole('button', { name: 'Capture photo' }).click();
  await expect(page.getByText('Photo saved. Creature unavailable. Try again later.')).toBeVisible({ timeout: 10000 });
  await expect(page.getByTestId('creature-reveal')).toHaveCount(0);
  await expect(page.getByTestId('capture-scene-dim')).toHaveCSS('opacity', '0');
  await page.getByRole('button', { name: /Retake photo|Take picture of new creature/ }).click();
  await expect(page.getByTestId('back-camera')).toBeVisible();
});

test('long creature text scrolls on a small phone and the new-entry cross opens the Pokédex', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await mockCreature(page, { longText: true });
  await page.goto('/');
  await page.getByRole('button', { name: 'Capture photo' }).click();
  await openEntry(page);
  await expect(page.getByTestId('creature-name')).toContainText('Extraordinary', { timeout: 10000 });
  await page.getByTestId('creature-description').scrollIntoViewIfNeeded();
  await expect(page.getByTestId('creature-description')).toBeInViewport();
  await expect(page.getByRole('button', { name: /Retake photo|Take picture of new creature/ })).toBeInViewport();
  await page.screenshot({ path: 'output/app-preview/creature-entry-small.png' });
  await expect(page.getByRole('button', { name: 'Close new entry and open Pokédex' })).toBeInViewport();
  await page.getByRole('button', { name: 'Close new entry and open Pokédex' }).click();
  await expect(page.getByTestId('pokedex-screen')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'BOX 01', exact: true })).toBeVisible();
});

test('View Pokédex after capture and View saved Pokédex each play one complete menu cue', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockCreature(page);
  await page.addInitScript(() => {
    const events: { boxVisible: boolean; finished: boolean; duration: number }[] = [];
    Object.assign(window, { collectionMenuEvents: events, trackCollectionMenu: false });
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      if (this.tagName === 'AUDIO' && !this.loop && (window as unknown as { trackCollectionMenu: boolean }).trackCollectionMenu) {
        const event = { boxVisible: false, finished: false, duration: 0 };
        this.addEventListener('playing', () => {
          event.boxVisible = !!document.querySelector('[data-testid="pokedex-screen"]');
          event.duration = this.duration;
          events.push(event);
        }, { once: true });
        this.addEventListener('ended', () => { event.finished = true; }, { once: true });
      }
      return play.call(this);
    };
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Capture photo' }).click();
  await expect(page.getByRole('button', { name: /Open Pokédex entry/ })).toBeEnabled({ timeout: 10000 });
  await page.evaluate(() => { (window as unknown as { trackCollectionMenu: boolean }).trackCollectionMenu = true; });
  await openEntry(page);
  await expect.poll(() => page.evaluate(() => (window as unknown as {
    collectionMenuEvents: { boxVisible: boolean; finished: boolean; duration: number }[];
  }).collectionMenuEvents)).toEqual([{ boxVisible: false, finished: true, duration: expect.closeTo(0.936, 1) }]);
  await page.evaluate(() => { (window as unknown as { collectionMenuEvents: unknown[] }).collectionMenuEvents.length = 0; });
  await page.getByRole('button', { name: 'View saved Pokédex' }).click();
  await expect(page.getByTestId('pokedex-screen')).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as unknown as {
    collectionMenuEvents: { boxVisible: boolean; finished: boolean; duration: number }[];
  }).collectionMenuEvents)).toEqual([{ boxVisible: true, finished: true, duration: expect.closeTo(0.936, 1) }]);
});

test('saved stats use the hexagon scale and survive a screen resize without rerolling', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockCreature(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Capture photo' }).click();
  await openEntry(page);
  const panel = page.getByTestId('creature-stats-panel');
  await panel.scrollIntoViewIfNeeded();
  await expect(panel).toBeInViewport();
  await expect(page.getByTestId('stats-hexagon')).toHaveAttribute('fill', '#9ce784');
  await expect(page.getByTestId('stats-values-polygon')).toHaveAttribute('fill', '#258be4');
  const values = await page.locator('[data-testid^="stat-value-"]').allTextContents();
  expect(values.map(Number)).toEqual([70, 140, 105, 87, 123, 77]);
  expect(values).toHaveLength(6);
  for (const value of values) {
    expect(Number.isInteger(Number(value))).toBe(true);
    expect(Number(value)).toBeGreaterThanOrEqual(70);
    expect(Number(value)).toBeLessThanOrEqual(140);
  }
  const points = await page.locator('[data-testid^="stat-point-"]').evaluateAll(nodes => nodes.map(node => ({
    x: Number(node.getAttribute('cx')), y: Number(node.getAttribute('cy')),
  })));
  points.forEach((point, index) => expect(Math.hypot(point.x - 180, point.y - 170)).toBeCloseTo(Number(values[index]) / 140 * 100, 5));
  await page.screenshot({ path: 'output/app-preview/creature-stats.png' });
  await page.setViewportSize({ width: 320, height: 640 });
  await panel.scrollIntoViewIfNeeded();
  expect(await page.locator('[data-testid^="stat-value-"]').allTextContents()).toEqual(values);
  await expect(page.getByTestId('creature-stats-chart')).toBeInViewport();
  await expect(page.getByRole('button', { name: 'Take picture of new creature' })).toBeInViewport();
  await page.screenshot({ path: 'output/app-preview/creature-stats-small.png' });
});

test('reduced motion fades to the spotlight without a flash, then opens the entry', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockCreature(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Capture photo' }).click();
  await expect(page.getByTestId('creature-reveal-scene')).toHaveCSS('opacity', '1', { timeout: 10000 });
  await expect(page.getByTestId('creature-radial-flash')).toHaveCount(0);
  await expect(page.getByTestId('creature-entry')).toHaveCount(0);
  await expect(page.getByTestId('recognition-celebration')).toBeVisible();
  await expect(page.locator('[data-testid^="recognition-star-"]')).toHaveCount(2);
  await expect(page.locator('[data-testid^="recognition-confetti-"]')).toHaveCount(0);
  await page.getByRole('button', { name: /Open Pokédex entry/ }).click();
  await expect(page.getByTestId('pokedex-curtains')).toBeVisible();
  await expect(page.getByTestId('pokedex-curtain-left')).toHaveCSS('transform', 'none');
  await expect(page.getByTestId('pokedex-curtain-right')).toHaveCSS('transform', 'none');
  await expect(page.getByTestId('pokedex-curtains')).toHaveCount(0);
  await expect(page.getByTestId('creature-entry')).toBeVisible({ timeout: 10000 });
  await expect(page.getByTestId('recognition-celebration')).toHaveCount(0);
  await expect(page.getByTestId('entry-reveal-glow')).toHaveCount(0);
  await expect(page.getByTestId('creature-display')).toHaveCSS('opacity', '1');
  await page.getByRole('button', { name: /Retake photo|Take picture of new creature/ }).click();
  await expect(page.getByTestId('back-camera')).toBeVisible();
  await expect(page.getByTestId('capture-scene-dim')).toHaveCSS('opacity', '0');
});

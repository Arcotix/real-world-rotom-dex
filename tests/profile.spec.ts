import { expect, test } from '@playwright/test';
import sharp from 'sharp';

test('sidebar profile saves a rounded portrait and name, with the entry scan and menu sound', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**:8787/entries', route => route.fulfill({ json: { entries: [], unavailableCount: 0 }, headers: { 'Access-Control-Allow-Origin': '*' } }));
  await page.addInitScript(() => {
    Object.assign(window, { profileSounds: [] as string[] });
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      if (this.tagName === 'AUDIO' && !this.loop) this.addEventListener('playing', () => (window as unknown as { profileSounds: string[] }).profileSounds.push(this.currentSrc), { once: true });
      return play.call(this);
    };
  });
  await page.goto('/pokedex');
  await page.getByRole('button', { name: 'Open sidebar' }).click();
  const profileButton = await page.getByRole('button', { name: 'Profile', exact: true }).boundingBox();
  const refresh = await page.getByRole('button', { name: 'Refresh Pokédex' }).boundingBox();
  const camera = await page.getByRole('button', { name: 'Back to camera' }).boundingBox();
  expect(refresh!.y).toBeGreaterThan(650);
  expect(camera!.y).toBeGreaterThan(refresh!.y);
  expect(profileButton!.y).toBeLessThan(200);
  await page.getByRole('button', { name: 'Profile', exact: true }).click();
  await expect.poll(() => page.getByTestId('profile-scan-right').evaluate(node => new DOMMatrix(getComputedStyle(node).transform).m41)).toBeGreaterThan(170);
  await expect.poll(() => page.evaluate(() => (window as unknown as { profileSounds: string[] }).profileSounds.length)).toBe(1);
  await page.getByRole('button', { name: 'Save profile', exact: true }).click();
  await expect(page.getByText('Enter your name to save your profile.')).toBeVisible();
  const portrait = await sharp({ create: { width: 240, height: 320, channels: 3, background: '#edaa77' } }).png().toBuffer();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Add profile photo' }).click();
  await (await chooser).setFiles({ name: 'portrait.png', mimeType: 'image/png', buffer: portrait });
  await expect(page.getByTestId('profile-photo')).toBeVisible();
  const photo = await page.getByTestId('profile-photo-button').boundingBox();
  expect(photo!.height).toBeCloseTo(photo!.width, 0);
  await expect(page.getByTestId('profile-photo-button')).toHaveCSS('border-radius', '24px');
  await page.getByRole('textbox', { name: 'NAME', exact: true }).fill('  Ash Ketchum  ');
  await page.getByRole('button', { name: 'Save profile', exact: true }).click();
  await expect(page.getByText('Profile saved.')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'NAME', exact: true })).toHaveValue('Ash Ketchum');
  await page.screenshot({ path: 'output/app-preview/profile.png' });
  await page.getByRole('button', { name: 'Close profile' }).click();
  await expect(page.getByTestId('profile-modal')).toHaveCount(0);
  await expect(page).toHaveURL(/\/pokedex$/);
  await page.getByRole('button', { name: 'Open sidebar' }).click();
  await page.getByRole('button', { name: 'Profile', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'NAME', exact: true })).toHaveValue('Ash Ketchum');
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'NAME', exact: true })).toHaveValue('Ash Ketchum');
  await expect(page.locator('[data-testid="profile-photo"] img')).toHaveJSProperty('complete', true);
  await expect(page.locator('[data-testid="profile-photo"] img')).toHaveJSProperty('naturalWidth', 240);
  expect(errors).toEqual([]);
});

test('failed profile saves preserve the draft and retry succeeds', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/pokedex/profile');
  await page.getByRole('textbox', { name: 'NAME', exact: true }).fill('Misty');
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function () {
      Storage.prototype.setItem = original;
      throw new DOMException('Storage full', 'QuotaExceededError');
    };
  });
  await page.getByRole('button', { name: 'Save profile', exact: true }).click();
  await expect(page.getByText(/Your profile could not be saved/)).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'NAME', exact: true })).toHaveValue('Misty');
  await page.getByRole('button', { name: 'Save profile', exact: true }).click();
  await expect(page.getByText('Profile saved.')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('profile-modal')).toHaveCount(0);
});

test('profile load recovery and reduced motion work on a small phone', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => localStorage.setItem('rotom-dex-profile', '{broken'));
  await page.goto('/pokedex/profile');
  await expect(page.getByText(/Your profile could not be loaded/)).toBeVisible();
  await page.evaluate(() => localStorage.removeItem('rotom-dex-profile'));
  await page.getByRole('button', { name: 'RETRY PROFILE' }).click();
  await expect(page.getByRole('textbox', { name: 'NAME', exact: true })).toBeVisible();
  await expect(page.getByTestId('profile-scan-left')).toHaveCount(0);
  await expect(page.getByTestId('profile-panel')).toHaveCSS('transform', 'none');
  await page.getByRole('textbox', { name: 'NAME', exact: true }).fill('A very long trainer name that still fits in the name field');
  await page.getByRole('button', { name: 'Save profile', exact: true }).scrollIntoViewIfNeeded();
  await expect(page.getByRole('button', { name: 'Save profile', exact: true })).toBeInViewport();
  await page.getByRole('button', { name: 'Save profile', exact: true }).click();
  await expect(page.getByText('Profile saved.')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.getByRole('button', { name: 'Close profile' }).click();
  await expect(page.getByTestId('profile-modal')).toHaveCount(0);
});

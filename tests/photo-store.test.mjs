import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import sharp from 'sharp';
import { createPhotoStore } from '../scripts/photo-store.mjs';

async function withStore(processImage, run, classifyImage = async () => ({ status: 'uncertain' })) {
  const directory = await mkdtemp(join(tmpdir(), 'rotom-photos-'));
  const server = createPhotoStore({ directory, entriesDirectory: join(directory, 'entries'), token: 'test-token', processImage, classifyImage });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const endpoint = `http://127.0.0.1:${server.address().port}`;
  const upload = (path, body, token = 'test-token') => fetch(`${endpoint}${path}`, {
    method: 'PUT', headers: { 'Content-Type': 'image/jpeg', Authorization: `Bearer ${token}` }, body,
  });
  const getPortrait = (name, auth = 'test-token') => fetch(`${endpoint}/photos/${name}`, { headers: { Authorization: `Bearer ${auth}` } });
  try { await run({ directory, upload, getPortrait }); }
  finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
}

const fixtureJpeg = (background) => sharp({ create: { width: 20, height: 20, channels: 3, background } }).jpeg().toBuffer();

test('default upload preserves the full camera photo and passes its background to Terra', async () => {
  const jpeg = await sharp({ create: { width: 80, height: 60, channels: 3, background: '#cc4422' } })
    .composite([{ input: await fixtureJpeg('blue'), left: 30, top: 20 }]).jpeg().toBuffer();
  const expected = await sharp(jpeg).rotate().png().toBuffer();
  let calls = 0;
  await withStore(undefined, async ({ upload, directory }) => {
    const name = '2026-11-10T12-30-00.123Z.png';
    const response = await upload(`/photos/${name}`, jpeg);
    assert.equal(response.status, 201);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), expected);
    assert.deepEqual(await readFile(join(directory, name)), expected);
    assert.equal(calls, 1);
    const metadata = await sharp(expected).metadata();
    assert.equal(metadata.width, 80);
    assert.equal(metadata.height, 60);
    assert.equal(metadata.hasAlpha, false, 'No local foreground segmentation should run');
  }, async input => { calls++; assert.deepEqual(input, expected); return { status: 'uncertain' }; });
});

test('stores and returns only processed transparent PNGs, preserving timestamps and retry safety', async () => {
  let processed = 0;
  const processor = async (input) => {
    processed++;
    const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    for (let y = 0; y < 10; y++) for (let x = 0; x < 20; x++) data[(y * 20 + x) * 4 + 3] = 0;
    return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
  };
  await withStore(processor, async ({ directory, upload }) => {
    const fileName = '2026-11-10T12-30-00.123Z.png';
    const bytes = await fixtureJpeg('red');
    const response = await upload(`/photos/${fileName}`, bytes);
    assert.equal(response.status, 201);
    assert.equal(response.headers.get('content-type'), 'image/png');
    assert.equal(response.headers.get('x-photo-name'), fileName);
    const output = await readFile(join(directory, fileName));
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), output);
    const { data, info } = await sharp(output).raw().toBuffer({ resolveWithObject: true });
    assert.equal(info.channels, 4);
    assert.equal(data[3], 0);
    assert.equal(data.at(-1), 255);
    assert.deepEqual(await readdir(directory), [fileName]);
    assert.equal(processed, 1);
    assert.equal((await upload(`/photos/${fileName}`, bytes)).status, 201);
    assert.equal((await upload(`/photos/${fileName}`, await fixtureJpeg('blue'))).status, 409);
    assert.deepEqual(await readFile(join(directory, fileName)), output);
    assert.equal((await upload('/photos/not-a-timestamp.png', bytes)).status, 400);
    assert.equal((await upload('/photos/%2E%2E%2Foutside.png', bytes)).status, 400);
    assert.equal((await upload('/photos/2026-11-10T12-31-00.123Z.png', Buffer.from('not jpeg'))).status, 415);
    assert.equal((await upload(`/photos/${fileName}`, bytes, 'wrong-token')).status, 401);
  });
});

test('processing failure never falls back to saving the raw photo', async () => {
  await withStore(async () => { throw new Error('Model unavailable'); }, async ({ directory, upload }) => {
    const response = await upload('/photos/2026-11-10T12-31-00.123Z.png', await fixtureJpeg('red'));
    assert.equal(response.status, 502);
    assert.deepEqual(await readdir(directory), []);
  });
});

test('recognition receives the processed PNG and returns its result with the unchanged cutout', async () => {
  const cutout = await sharp({ create: { width: 20, height: 20, channels: 4, background: '#0000' } }).png().toBuffer();
  const recognition = { status: 'recognized', label: 'stapler', score: 0.91 };
  let calls = 0;
  await withStore(async () => cutout, async ({ directory, upload }) => {
    const name = '2026-11-10T12-31-00.123Z.png';
    const response = await upload(`/photos/${name}`, await fixtureJpeg('red'));
    assert.equal(response.status, 201);
    assert.deepEqual(JSON.parse(decodeURIComponent(response.headers.get('x-object-recognition'))), recognition);
    assert.match(response.headers.get('access-control-expose-headers'), /X-Object-Recognition/);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), cutout);
    assert.deepEqual(await readFile(join(directory, name)), cutout);
    assert.equal(calls, 1);
  }, async (input) => { calls++; assert.deepEqual(input, cutout); return recognition; });
});

test('recognition failure still saves the cutout and reports unavailable', async () => {
  const cutout = await sharp({ create: { width: 20, height: 20, channels: 4, background: '#0000' } }).png().toBuffer();
  await withStore(async () => cutout, async ({ upload }) => {
    const response = await upload('/photos/2026-11-10T12-31-00.123Z.png', await fixtureJpeg('red'));
    assert.equal(response.status, 201);
    assert.deepEqual(JSON.parse(decodeURIComponent(response.headers.get('x-object-recognition'))), { status: 'unavailable' });
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), cutout);
  }, async () => { throw new Error('Recognition unavailable'); });
});

test('creature portraits and Unicode names are saved, authenticated, and reused on retry', async () => {
  const cutout = await sharp({ create: { width: 40, height: 40, channels: 4, background: '#caad68' } }).png().toBuffer();
  const portrait = await sharp({ create: { width: 40, height: 40, channels: 4, background: '#bcdd9e' } }).png().toBuffer();
  let calls = 0;
  await withStore(async () => cutout, async ({ upload, directory, getPortrait }) => {
    const name = '2026-11-10T12-31-00.123Z.png';
    const portraitName = name.replace('.png', '.creature.png');
    const jpeg = await fixtureJpeg('red');
    const [first, concurrent] = await Promise.all([upload(`/photos/${name}`, jpeg), upload(`/photos/${name}`, jpeg)]);
    assert.equal(concurrent.status, 201);
    const result = JSON.parse(decodeURIComponent(first.headers.get('x-object-recognition')));
    assert.equal(result.creature.name, 'Clickclaw ✨');
    assert.equal(result.creature.imageName, portraitName);
    assert.deepEqual(Buffer.from(await first.arrayBuffer()), cutout);
    assert.deepEqual(await readFile(join(directory, name)), cutout);
    assert.deepEqual(await readFile(join(directory, portraitName)), portrait);
    assert.equal((await getPortrait(portraitName, 'wrong')).status, 401);
    assert.equal((await getPortrait('../package.json')).status, 400);
    const fetched = await getPortrait(portraitName);
    assert.equal(fetched.status, 200);
    assert.deepEqual(Buffer.from(await fetched.arrayBuffer()), portrait);
    assert.equal((await getPortrait('2026-11-10T00-00-00.000Z.creature.png')).status, 404);
    await upload(`/photos/${name}`, jpeg);
    assert.equal(calls, 1, 'Retried uploads must not spend another Codex call');
    assert.equal(JSON.parse(await readFile(join(directory, name.replace('.png', '.creature.json')), 'utf8')).creature.name, 'Clickclaw ✨');
  }, async () => { calls++; await new Promise((resolve) => setTimeout(resolve, 30)); return { status: 'recognized', label: 'computer mouse', creature: { style: 'dex-v2', name: 'Clickclaw ✨', description: 'A tiny desk companion with a wiggly grin.' }, portrait, face: { x: 0.5, y: 0.5, width: 0.25 } }; });
});

test('legacy card artwork is regenerated as an entry and subsequent retries reuse it', async () => {
  const photo = await sharp({ create: { width: 40, height: 40, channels: 3, background: '#caad68' } }).png().toBuffer();
  let calls = 0;
  await withStore(async () => photo, async ({ upload }) => {
    const name = '2026-11-10T12-31-00.123Z.png';
    const jpeg = await fixtureJpeg('red');
    await upload(`/photos/${name}`, jpeg);
    const updated = await upload(`/photos/${name}`, jpeg);
    assert.equal(JSON.parse(decodeURIComponent(updated.headers.get('x-object-recognition'))).creature.style, 'dex-v2');
    await upload(`/photos/${name}`, jpeg);
    assert.equal(calls, 2);
  }, async () => {
    calls++;
    return { status: 'recognized', label: 'mouse', creature: { style: calls === 1 ? 'grand-v1' : 'dex-v2', name: 'Clickclaw', description: 'A desk tyrant.' }, portrait: photo };
  });
});

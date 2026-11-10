import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import sharp from 'sharp';
import { createPhotoStore } from '../scripts/photo-store.mjs';
import { isCreatureCry } from '../src/utils/creature-cry.ts';
import { isCreatureStats } from '../src/utils/creature-stats.ts';

const firstName = '2026-11-11T12-30-00.123Z.png';
const secondName = '2026-11-11T12-30-00.124Z.png';
const creature = { style: 'dex-v2', name: 'Clickclaw ✨', description: 'A desk tyrant that wages war on loose clicks.',
  element: 'Electric', rarity: 'rare', category: 'The Desk Companion', heightCm: 12, weightKg: 0.15, eyebrow: 'skeptical',
  stats: { health: 999 }, cry: '../../outside' };
const generation = { model: 'test-model', portraitPrompt: 'test prompt', timingsMs: { total: 50 } };

async function withStore(run) {
  const root = await mkdtemp(join(tmpdir(), 'rotom-pokedex-'));
  const photosDirectory = join(root, 'photos');
  const entriesDirectory = join(root, 'saved-pokedex-entries');
  const capture = await sharp({ create: { width: 20, height: 20, channels: 3, background: '#334455' } }).png().toBuffer();
  const portrait = await sharp({ create: { width: 20, height: 20, channels: 4, background: '#0000' } }).png().toBuffer();
  const jpeg = await sharp(capture).jpeg().toBuffer();
  let calls = 0;
  let server;
  let endpoint;
  async function start(status = 'recognized') {
    server = createPhotoStore({ directory: photosDirectory, entriesDirectory, token: 'test',
      processImage: async () => capture,
      classifyImage: async () => {
        calls++;
        return status === 'recognized' ? { status, label: 'computer mouse', creature, portrait, generation } : { status };
      },
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    endpoint = `http://127.0.0.1:${server.address().port}`;
  }
  async function stop() { await new Promise(resolve => server.close(resolve)); }
  const upload = (name = firstName, token = 'test') => fetch(`${endpoint}/photos/${name}`, {
    method: 'PUT', headers: { 'Content-Type': 'image/jpeg', Authorization: `Bearer ${token}` }, body: jpeg,
  });
  const readEntry = name => readFile(join(entriesDirectory, name.slice(0, -4), 'entry.json'), 'utf8').then(JSON.parse);
  const get = (path, token = 'test') => fetch(`${endpoint}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  try {
    await start();
    await run({ root, photosDirectory, entriesDirectory, capture, portrait, upload, readEntry, get, start, stop, calls: () => calls });
  } finally { if (server.listening) await stop(); await rm(root, { recursive: true, force: true }); }
}

test('a capture archives its full entry, both pictures and the exact cry before replying', async () => {
  await withStore(async ({ upload, readEntry, entriesDirectory, capture, portrait }) => {
    const response = await upload();
    assert.equal(response.status, 201);
    const result = JSON.parse(decodeURIComponent(response.headers.get('x-object-recognition')));
    const entry = await readEntry(firstName);
    assert.equal(entry.schemaVersion, 1);
    assert.equal(entry.id, firstName.slice(0, -4));
    assert.equal(entry.capturedAt, '2026-11-11T12:30:00.123Z');
    assert.ok(Number.isFinite(Date.parse(entry.savedAt)));
    for (const field of ['name', 'description', 'category', 'element', 'rarity', 'heightCm', 'weightKg', 'eyebrow', 'style']) assert.deepEqual(entry[field], creature[field]);
    assert.equal(entry.object, 'computer mouse');
    assert.equal(entry.fieldNotes, creature.description);
    assert.deepEqual(entry.types, ['Electric']);
    assert.equal(entry.measurementsEstimated, true);
    assert.deepEqual(entry.generation, generation);
    assert.ok(isCreatureStats(entry.stats), 'AI-supplied stats must be replaced with six random values');
    assert.ok(isCreatureCry(entry.cry), 'AI-supplied cry must be replaced with a bundled cry');
    assert.deepEqual(result.creature.stats, entry.stats);
    assert.equal(result.creature.cry, entry.cry);
    assert.equal(result.creature.rarity, entry.rarity);
    const folder = join(entriesDirectory, entry.id);
    assert.deepEqual((await readdir(folder)).sort(), ['capture.png', 'cry.mp3', 'entry.json', 'picture.png']);
    assert.deepEqual(await readFile(join(folder, entry.files.picture)), portrait);
    assert.deepEqual(await readFile(join(folder, entry.files.capture)), capture);
    assert.deepEqual(await readFile(join(folder, entry.files.cry)), await readFile(new URL(`../assets/pokemon-cries/${entry.cry}.mp3`, import.meta.url)));
    // A second capture of the same object is a separate PC entry.
    assert.equal((await upload(secondName)).status, 201);
    assert.equal((await readEntry(secondName)).id, secondName.slice(0, -4));
    assert.deepEqual((await readdir(entriesDirectory)).sort(), [firstName.slice(0, -4), secondName.slice(0, -4)]);
  });
});

test('the authenticated gallery lists saved entries in capture order and serves small sprites and archived media', async () => {
  await withStore(async ({ upload, get, entriesDirectory, portrait, readEntry }) => {
    assert.equal((await get('/entries', 'wrong')).status, 401);
    assert.deepEqual(await (await get('/entries')).json(), { entries: [], unavailableCount: 0 });
    await upload(secondName);
    await upload(firstName);
    const response = await get('/entries');
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const result = await response.json();
    assert.deepEqual(result.entries.map(entry => entry.id), [firstName.slice(0, -4), secondName.slice(0, -4)]);
    assert.deepEqual(result.entries[0].stats, (await readEntry(firstName)).stats);
    assert.equal(result.entries[0].generation, undefined);
    const prefix = `/entries/${result.entries[0].id}`;
    assert.equal((await get(`${prefix}/thumbnail.png`, 'wrong')).status, 401);
    const sprite = await get(`${prefix}/thumbnail.png`);
    const metadata = await sharp(Buffer.from(await sprite.arrayBuffer())).metadata();
    assert.equal(metadata.width, 112);
    assert.equal(metadata.height, 112);
    assert.equal(metadata.hasAlpha, true);
    assert.deepEqual(Buffer.from(await (await get(`${prefix}/picture.png`)).arrayBuffer()), portrait);
    const cry = await get(`${prefix}/cry.mp3`);
    assert.equal(cry.headers.get('content-type'), 'audio/mpeg');
    assert.deepEqual(Buffer.from(await cry.arrayBuffer()), await readFile(join(entriesDirectory, result.entries[0].id, 'cry.mp3')));
    assert.equal((await get(`${prefix}/entry.json`)).status, 400, 'Only allow listed media filenames');
    assert.equal((await get('/entries/2026-01-01T00-00-00.000Z/picture.png')).status, 404);
    await mkdir(join(entriesDirectory, '.pending-incomplete'));
    const corrupt = join(entriesDirectory, '2026-11-11T12-30-00.125Z');
    await mkdir(corrupt);
    await writeFile(join(corrupt, 'entry.json'), '{bad json');
    const partial = await (await get('/entries')).json();
    assert.equal(partial.entries.length, 2);
    assert.equal(partial.unavailableCount, 1);
  });
});

test('concurrent uploads, lost-response retries and server restarts reuse one entry and its rolls', async () => {
  await withStore(async ({ upload, readEntry, entriesDirectory, start, stop, calls }) => {
    const responses = await Promise.all([upload(), upload(), upload()]);
    for (const response of responses) assert.equal(response.status, 201);
    const entry = await readEntry(firstName);
    for (const response of responses) {
      const result = JSON.parse(decodeURIComponent(response.headers.get('x-object-recognition')));
      assert.deepEqual(result.creature.stats, entry.stats);
      assert.equal(result.creature.cry, entry.cry);
      assert.equal(result.creature.rarity, entry.rarity);
    }
    await stop();
    await start();
    assert.equal((await upload()).status, 201);
    assert.deepEqual(await readEntry(firstName), entry);
    assert.equal(calls(), 1, 'Retry must reuse the generated artwork');
    assert.deepEqual(await readdir(entriesDirectory), [entry.id]);
  });
});

test('an archive write failure fails the save and retry recovers without generating again', async () => {
  await withStore(async ({ upload, readEntry, entriesDirectory, calls }) => {
    await writeFile(entriesDirectory, 'simulate unavailable folder');
    assert.equal((await upload()).status, 500);
    await rm(entriesDirectory);
    assert.equal((await upload()).status, 201);
    assert.ok(isCreatureStats((await readEntry(firstName)).stats));
    assert.equal(calls(), 1);
    assert.deepEqual(await readdir(entriesDirectory), [firstName.slice(0, -4)]);
  });
});

test('uncertain and unavailable results, invalid paths and unauthorized uploads do not create PC entries', async () => {
  await withStore(async ({ upload, entriesDirectory, start, stop }) => {
    assert.equal((await upload(firstName, 'wrong')).status, 401);
    assert.equal((await upload('not-a-capture.png')).status, 400);
    for (const status of ['uncertain', 'unavailable']) {
      await stop();
      await start(status);
      assert.equal((await upload()).status, 201);
      await assert.rejects(readdir(entriesDirectory), { code: 'ENOENT' });
    }
  });
});

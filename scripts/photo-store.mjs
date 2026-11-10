import { createServer } from 'node:http';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import sharp from 'sharp';
import { CREATURE_STYLE, createCreature } from './codex-creature.mjs';
import { createPokedexStore, listPokedexEntries } from './pokedex-store.mjs';

async function normalizePhoto(input) {
  return sharp(input, { limitInputPixels: 80000000 }).rotate().png().toBuffer();
}

export function createPhotoStore({ directory, entriesDirectory = join(directory, '..', 'saved-pokedex-entries'), token, processImage = normalizePhoto, classifyImage = createCreature }) {
  const jobs = new Map();
  const archiveEntry = createPokedexStore({ directory: entriesDirectory, photosDirectory: directory });
  async function writeArtifact(name, bytes) {
    const temporary = join(directory, `.${name}.${randomUUID()}.tmp`);
    try { await writeFile(temporary, bytes); await rename(temporary, join(directory, name)); }
    finally { await rm(temporary, { force: true }); }
  }
  async function makeCreature(fileName, foreground) {
    const stem = fileName.slice(0, -4);
    const metadataName = `${stem}.creature.json`;
    try {
      const cached = JSON.parse(await readFile(join(directory, metadataName), 'utf8'));
      if (cached.status === 'recognized' && cached.creature?.style === CREATURE_STYLE && cached.creature?.imageName === `${stem}.creature.png`) {
        await readFile(join(directory, cached.creature.imageName));
        const { generation, face, ...recognition } = cached;
        return recognition;
      }
    } catch { /* Missing or incomplete artifacts are regenerated on retry. */ }
    if (jobs.has(fileName)) return jobs.get(fileName);
    const job = (async () => {
      const { portrait, face, generation, ...recognition } = await classifyImage(foreground);
      if (portrait && recognition.status === 'recognized' && recognition.creature) {
        if (!Buffer.isBuffer(portrait) || !portrait.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw new Error('Invalid creature PNG');
        const imageName = `${stem}.creature.png`;
        recognition.creature = { ...recognition.creature, imageName };
        await writeArtifact(imageName, portrait);
        await writeArtifact(metadataName, JSON.stringify({ ...recognition, generation }, null, 2));
      }
      return recognition;
    })();
    jobs.set(fileName, job);
    try { return await job; } finally { jobs.delete(fileName); }
  }
  return createServer(async (request, response) => {
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Expose-Headers': 'X-Photo-Name, X-Object-Recognition',
      'Content-Type': 'application/json',
    };
    const reply = (status, value) => { response.writeHead(status, headers); response.end(JSON.stringify(value)); };
    if (request.method === 'OPTIONS') return reply(204, null);
    if (request.method === 'GET' && request.url === '/health') return reply(200, { ready: true });
    const supplied = Buffer.from(request.headers.authorization ?? '');
    const expected = Buffer.from(`Bearer ${token}`);
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return reply(401, { error: 'Unauthorized' });
    if (request.method === 'GET' && request.url === '/entries') {
      headers['Cache-Control'] = 'no-store';
      try { return reply(200, await listPokedexEntries(entriesDirectory)); }
      catch { return reply(500, { error: 'Could not read the Pokédex' }); }
    }
    const entryAsset = /^\/entries\/(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.\d{3}Z)\/(picture\.png|thumbnail\.png|cry\.mp3)$/.exec(request.url ?? '');
    if (request.method === 'GET' && entryAsset) {
      try {
        const thumbnail = entryAsset[2] === 'thumbnail.png';
        const audio = entryAsset[2] === 'cry.mp3';
        const original = await readFile(join(entriesDirectory, entryAsset[1], thumbnail ? 'picture.png' : entryAsset[2]));
        const bytes = thumbnail ? await sharp(original).resize(112, 112, { fit: 'contain', background: '#0000' }).png().toBuffer() : original;
        response.writeHead(200, { ...headers, 'Content-Type': audio ? 'audio/mpeg' : 'image/png', 'Cache-Control': 'private, max-age=86400' });
        return response.end(bytes);
      } catch (error) { return reply(error.code === 'ENOENT' ? 404 : 500, { error: 'Saved specimen asset unavailable' }); }
    }
    const portraitMatch = /^\/photos\/(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.\d{3}Z\.creature\.png)$/.exec(request.url ?? '');
    if (request.method === 'GET' && portraitMatch) {
      try {
        const portrait = await readFile(join(directory, portraitMatch[1]));
        response.writeHead(200, { ...headers, 'Content-Type': 'image/png', 'Cache-Control': 'private, max-age=86400' });
        return response.end(portrait);
      } catch (error) { return reply(error.code === 'ENOENT' ? 404 : 500, { error: 'Creature portrait unavailable' }); }
    }
    const match = /^\/photos\/(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.\d{3}Z\.png)$/.exec(request.url ?? '');
    if (request.method !== 'PUT' || !match) return reply(400, { error: 'Expected a timestamped PNG destination' });
    if (request.headers['content-type'] !== 'image/jpeg') return reply(415, { error: 'Expected image/jpeg' });
    try {
      const chunks = [];
      let size = 0;
      for await (const chunk of request) {
        size += chunk.length;
        if (size > 25 * 1024 * 1024) { reply(413, { error: 'Photo exceeds 25MB' }); request.resume(); return; }
        chunks.push(chunk);
      }
      const bytes = Buffer.concat(chunks);
      if (bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes.at(-2) !== 0xff || bytes.at(-1) !== 0xd9) return reply(415, { error: 'Invalid JPEG' });
      let foreground;
      try {
        foreground = await processImage(bytes);
        if (!Buffer.isBuffer(foreground) || !foreground.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw new Error('Invalid processed PNG');
      } catch (error) {
        console.error('Photo decoding failed:', error.message);
        return reply(502, { error: 'Could not decode the captured photo. Please retry.' });
      }
      await mkdir(directory, { recursive: true });
      const destination = join(directory, match[1]);
      try {
        await writeFile(destination, foreground, { flag: 'wx' });
      } catch (error) {
        if (error.code !== 'EEXIST') throw error;
        if (!(await readFile(destination)).equals(foreground)) return reply(409, { error: 'A different photo already has this timestamp' });
      }
      let recognition;
      try {
        recognition = await makeCreature(match[1], foreground);
      } catch (error) {
        console.error('Creature creation failed:', error.code || error.name || 'Unknown error');
        recognition = { status: 'unavailable' };
      }
      if (recognition.status === 'recognized' && recognition.creature) {
        // Archive failures fail the save, retaining the app's capture for retry.
        // AI-supplied gameplay values are always replaced by the saved rolls.
        const entry = await archiveEntry(match[1], recognition);
        recognition = { ...recognition, creature: { ...recognition.creature, rarity: entry.rarity ?? 'common', stats: entry.stats, cry: entry.cry } };
      }
      response.writeHead(201, { ...headers, 'Content-Type': 'image/png', 'X-Photo-Name': match[1], 'X-Object-Recognition': encodeURIComponent(JSON.stringify(recognition)) });
      response.end(foreground);
    } catch {
      if (!response.headersSent) reply(500, { error: 'Could not save photo' });
    }
  });
}

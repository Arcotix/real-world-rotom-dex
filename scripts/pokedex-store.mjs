import { mkdtemp, mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chooseCreatureCry, isCreatureCry } from '../src/utils/creature-cry.ts';
import { createCreatureStats, isCreatureStats } from '../src/utils/creature-stats.ts';
import { isCreatureRarity } from '../src/utils/creature-rarity.ts';

const criesDirectory = fileURLToPath(new URL('../assets/pokemon-cries/', import.meta.url));
const entryId = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.\d{3}Z$/;

export async function listPokedexEntries(directory) {
  let folders;
  try { folders = await readdir(directory, { withFileTypes: true }); }
  catch (error) { if (error.code === 'ENOENT') return { entries: [], unavailableCount: 0 }; throw error; }
  const results = await Promise.allSettled(folders.filter(folder => folder.isDirectory() && entryId.test(folder.name))
    .sort((a, b) => a.name.localeCompare(b.name)).map(async folder => {
      const entry = JSON.parse(await readFile(join(directory, folder.name, 'entry.json'), 'utf8'));
      if (entry.schemaVersion !== 1 || entry.id !== folder.name || typeof entry.name !== 'string' || !entry.name.trim() || entry.name.length > 40 ||
        typeof entry.description !== 'string' || entry.description.length > 240 || !isCreatureStats(entry.stats) || !isCreatureCry(entry.cry)) throw new Error('Invalid entry');
      // The gallery needs saved gameplay and field notes, not generation logs.
      const { generation, source, ...details } = entry;
      return details;
    }));
  return { entries: results.filter(result => result.status === 'fulfilled').map(result => result.value),
    unavailableCount: results.filter(result => result.status === 'rejected').length };
}

// Publish a complete folder with one atomic rename. A capture timestamp is its
// stable ID, so repeated uploads never overwrite or reroll an existing entry.
export function createPokedexStore({ directory, photosDirectory }) {
  const jobs = new Map();

  async function readEntry(id) {
    const folder = join(directory, id);
    let entry;
    try { entry = JSON.parse(await readFile(join(folder, 'entry.json'), 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return null; throw error; }
    if (entry.id !== id || entry.schemaVersion !== 1 || !isCreatureStats(entry.stats) || !isCreatureCry(entry.cry)) {
      throw new Error('Invalid saved Pokédex entry');
    }
    const files = await Promise.all(['picture.png', 'capture.png', 'cry.mp3'].map(name => stat(join(folder, name))));
    if (files.some(file => !file.isFile() || file.size === 0)) throw new Error('Incomplete saved Pokédex entry');
    return entry;
  }

  async function archive(fileName, recognition) {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.\d{3}Z\.png$/.test(fileName)) throw new Error('Invalid capture filename');
    const id = fileName.slice(0, -4);
    const existing = await readEntry(id);
    if (existing) return existing;

    const creature = recognition.creature;
    const cry = chooseCreatureCry();
    const [picture, capture, audio, metadata] = await Promise.all([
      readFile(join(photosDirectory, `${id}.creature.png`)),
      readFile(join(photosDirectory, fileName)),
      readFile(join(criesDirectory, `${cry}.mp3`)),
      readFile(join(photosDirectory, `${id}.creature.json`), 'utf8').then(JSON.parse),
    ]);
    const entry = {
      schemaVersion: 1,
      id,
      capturedAt: id.replace(/T(\d{2})-(\d{2})-(\d{2})/, 'T$1:$2:$3'),
      savedAt: new Date().toISOString(),
      object: recognition.label,
      name: creature.name,
      description: creature.description,
      fieldNotes: creature.description,
      category: creature.category || 'The Everyday Wonder',
      element: creature.element || 'Normal',
      types: [creature.element || 'Normal'],
      rarity: isCreatureRarity(creature.rarity) ? creature.rarity : 'common',
      heightCm: creature.heightCm ?? null,
      weightKg: creature.weightKg ?? null,
      measurementsEstimated: true,
      eyebrow: creature.eyebrow ?? null,
      style: creature.style,
      stats: createCreatureStats(),
      cry,
      files: { picture: 'picture.png', capture: 'capture.png', cry: 'cry.mp3' },
      source: { photoName: fileName, imageName: `${id}.creature.png` },
      generation: metadata.generation ?? null,
    };
    await mkdir(directory, { recursive: true });
    const staging = await mkdtemp(join(directory, `.pending-${id}-`));
    try {
      const writes = await Promise.allSettled([
        writeFile(join(staging, 'picture.png'), picture),
        writeFile(join(staging, 'capture.png'), capture),
        writeFile(join(staging, 'cry.mp3'), audio),
        writeFile(join(staging, 'entry.json'), `${JSON.stringify(entry, null, 2)}\n`),
      ]);
      for (const write of writes) if (write.status === 'rejected') throw write.reason;
      try { await rename(staging, join(directory, id)); }
      catch (error) {
        if (!['EEXIST', 'ENOTEMPTY'].includes(error.code)) throw error;
        const winner = await readEntry(id);
        if (!winner) throw error;
        return winner;
      }
      return entry;
    } finally { await rm(staging, { recursive: true, force: true }); }
  }

  return async (fileName, recognition) => {
    if (!jobs.has(fileName)) jobs.set(fileName, archive(fileName, recognition));
    const job = jobs.get(fileName);
    try { return await job; }
    finally { if (jobs.get(fileName) === job) jobs.delete(fileName); }
  };
}

import { isCreatureCry, type CreatureCry } from '@/utils/creature-cry';
import { isCreatureStats, type CreatureStats } from '@/utils/creature-stats';
import creatureTypes from '@/constants/creature-types.json';
import { photoStoreHeaders, photoStoreUrl } from '@/utils/photo-store-client';
import { isCreatureRarity, type CreatureRarity } from '@/utils/creature-rarity';

export type SavedEntry = {
  id: string; name: string; description: string; fieldNotes: string; object: string;
  category: string; element: string; rarity: CreatureRarity; heightCm: number | null; weightKg: number | null;
  stats: CreatureStats; cry: CreatureCry; capturedAt: string;
};

export function parseSavedEntry(value: unknown): SavedEntry {
  if (!value || typeof value !== 'object') throw new Error('Invalid saved entry.');
  const entry = value as Record<string, unknown>;
  if (typeof entry.id !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.\d{3}Z$/.test(entry.id) ||
    typeof entry.name !== 'string' || !entry.name.trim() || entry.name.length > 40 ||
    typeof entry.description !== 'string' || entry.description.length > 240 ||
    !isCreatureStats(entry.stats) || !isCreatureCry(entry.cry)) throw new Error('Invalid saved entry.');
  const positive = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 10000 ? value : null;
  return {
    id: entry.id, name: entry.name, description: entry.description,
    fieldNotes: typeof entry.fieldNotes === 'string' ? entry.fieldNotes : entry.description,
    object: typeof entry.object === 'string' ? entry.object : 'creature',
    category: typeof entry.category === 'string' ? entry.category : 'The Everyday Wonder',
    element: typeof entry.element === 'string' && creatureTypes.includes(entry.element) ? entry.element : 'Normal',
    rarity: isCreatureRarity(entry.rarity) ? entry.rarity : 'common',
    heightCm: positive(entry.heightCm), weightKg: positive(entry.weightKg),
    stats: entry.stats, cry: entry.cry,
    capturedAt: typeof entry.capturedAt === 'string' ? entry.capturedAt : '',
  };
}

export async function fetchPokedex(signal: AbortSignal) {
  const response = await fetch(`${photoStoreUrl()}/entries`, { headers: photoStoreHeaders(), signal });
  if (!response.ok) throw new Error('Your Pokédex could not be loaded. Check the connection to your computer.');
  const data = await response.json();
  if (!Array.isArray(data.entries)) throw new Error('The saved Pokédex could not be read.');
  return { entries: data.entries.map(parseSavedEntry) as SavedEntry[], unavailableCount: Number(data.unavailableCount) || 0 };
}

export function entryAssetSource(id: string, asset: 'picture.png' | 'thumbnail.png' | 'cry.mp3') {
  return { uri: `${photoStoreUrl()}/entries/${encodeURIComponent(id)}/${asset}`, headers: photoStoreHeaders() };
}

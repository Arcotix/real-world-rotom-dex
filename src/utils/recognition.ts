import { isCreatureCry, type CreatureCry } from '@/utils/creature-cry';
import creatureTypes from '@/constants/creature-types.json';
import { isCreatureStats, type CreatureStats } from '@/utils/creature-stats';
import { isCreatureRarity, type CreatureRarity } from '@/utils/creature-rarity';

export type CreatureDetails = {
  name: string; description: string; imageName: string;
  stats: CreatureStats; cry: CreatureCry; rarity?: CreatureRarity;
  style?: 'dex-v2'; element?: string; category?: string; eyebrow?: string; heightCm?: number; weightKg?: number;
};

export type Recognition =
  | { status: 'recognized'; label: string; creature?: CreatureDetails }
  | { status: 'uncertain' | 'unavailable' };

export function parseRecognition(header: string | null): Recognition {
  try {
    const value = JSON.parse(header?.startsWith('{') ? header : decodeURIComponent(header ?? 'null'));
    if (value?.status === 'recognized' && typeof value.label === 'string' && value.label.trim().length > 0 && value.label.length <= 80) {
      const result: Recognition = { status: 'recognized', label: value.label };
      const creature = value.creature;
      if (creature && typeof creature.name === 'string' && creature.name.trim().length > 0 && creature.name.length <= 40 &&
        typeof creature.description === 'string' && creature.description.trim().length > 0 && creature.description.length <= 240 &&
        typeof creature.imageName === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.\d{3}Z\.creature\.png$/.test(creature.imageName) &&
        isCreatureStats(creature.stats) && isCreatureCry(creature.cry)) {
        // The photo server assigns and saves gameplay values before replying.
        // Reuse them so retries, playback and the future PC share one identity.
        result.creature = { name: creature.name, description: creature.description, imageName: creature.imageName, stats: creature.stats, cry: creature.cry };
        if (creature.style === 'dex-v2') result.creature.style = 'dex-v2';
        if (creatureTypes.includes(creature.element)) result.creature.element = creature.element;
        result.creature.rarity = isCreatureRarity(creature.rarity) ? creature.rarity : 'common';
        for (const field of ['heightCm', 'weightKg'] as const) {
          if (Number.isFinite(creature[field]) && creature[field] > 0 && creature[field] <= 10000) result.creature[field] = creature[field];
        }
        for (const field of ['category', 'eyebrow'] as const) {
          const limit = field === 'category' ? 40 : 100;
          if (typeof creature[field] === 'string' && creature[field].trim().length > 0 && creature[field].length <= limit) result.creature[field] = creature[field];
        }

      }
      return result;
    }
    if (value?.status === 'uncertain') return { status: 'uncertain' };
  } catch { /* A missing or malformed result must never trigger a celebration. */ }
  return { status: 'unavailable' };
}

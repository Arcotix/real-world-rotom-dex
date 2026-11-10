export const CREATURE_RARITIES = ['common', 'rare', 'legendary', 'mythical'] as const;
export type CreatureRarity = typeof CREATURE_RARITIES[number];

export function isCreatureRarity(value: unknown): value is CreatureRarity {
  return typeof value === 'string' && CREATURE_RARITIES.some(rarity => rarity === value);
}

export const RARITY_BADGES: Record<CreatureRarity, { backgroundColor: string; color: string }> = {
  common: { backgroundColor: '#d1d5db', color: '#303a46' },
  rare: { backgroundColor: '#bae6fd', color: '#16496b' },
  legendary: { backgroundColor: '#fef08a', color: '#644c0b' },
  mythical: { backgroundColor: '#9333ea', color: '#ffffff' },
};

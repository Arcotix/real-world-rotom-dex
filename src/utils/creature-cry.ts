export const CREATURE_CRIES = ['aerodactyl', 'aggron', 'aipom', 'altaria', 'ampharos', 'bellossom'] as const;
export type CreatureCry = (typeof CREATURE_CRIES)[number];

export function isCreatureCry(value: unknown): value is CreatureCry {
  return typeof value === 'string' && (CREATURE_CRIES as readonly string[]).includes(value);
}

// Select once when archiving a capture; AI generation never chooses the cry.
export function chooseCreatureCry(random: () => number = Math.random): CreatureCry {
  return CREATURE_CRIES[Math.floor(random() * CREATURE_CRIES.length)];
}

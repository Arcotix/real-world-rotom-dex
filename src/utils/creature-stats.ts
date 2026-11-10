export const STAT_AXES = [
  { key: 'health', label: 'Health' },
  { key: 'attack', label: 'Attack' },
  { key: 'defense', label: 'Defense' },
  { key: 'speed', label: 'Speed' },
  { key: 'specialDefense', label: 'Spl Defense' },
  { key: 'specialAttack', label: 'Spl Attack' },
] as const;

export type CreatureStats = Record<(typeof STAT_AXES)[number]['key'], number>;

export function isCreatureStats(value: unknown): value is CreatureStats {
  return typeof value === 'object' && value !== null && STAT_AXES.every(({ key }) => {
    const stat = (value as Record<string, unknown>)[key];
    return typeof stat === 'number' && Number.isInteger(stat) && stat >= 70 && stat <= 140;
  });
}

// Six independent integer draws, inclusive of 70 and 140. No model input is used.
export function createCreatureStats(random: () => number = Math.random): CreatureStats {
  return Object.fromEntries(STAT_AXES.map(({ key }) => [key, 70 + Math.floor(random() * 71)])) as CreatureStats;
}

export function statPoint(index: number, value: number, radius = 100, center = { x: 180, y: 170 }) {
  const angle = (-90 + index * 60) * Math.PI / 180;
  const distance = radius * value / 140;
  return { x: center.x + Math.cos(angle) * distance, y: center.y + Math.sin(angle) * distance };
}

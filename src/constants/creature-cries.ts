import type { CreatureCry } from '@/utils/creature-cry';

export const CRY_AUDIO = {
  aerodactyl: require('../../assets/pokemon-cries/aerodactyl.mp3'),
  aggron: require('../../assets/pokemon-cries/aggron.mp3'),
  aipom: require('../../assets/pokemon-cries/aipom.mp3'),
  altaria: require('../../assets/pokemon-cries/altaria.mp3'),
  ampharos: require('../../assets/pokemon-cries/ampharos.mp3'),
  bellossom: require('../../assets/pokemon-cries/bellossom.mp3'),
} satisfies Record<CreatureCry, number>;

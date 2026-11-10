// Coordinates use the original 540 × 960 still. Both media files are 9:16.
export const ARTWORK = { width: 540, height: 960 };
export const OPENING_VIDEO = require('../../assets/rotom-wake-inner-grid-1s.mp4');
export const OPENING_AUDIO = require('../../assets/rotom_opening.mp3');
export const CAPTURE_AUDIO = require('../../assets/rotom_pic_taken_camera.mp3');
export const IDENTIFIED_AUDIO = require('../../assets/identified_caught_sound.mp3');
export const FLASH_AUDIO = require('../../assets/sparkle-flash-effect.mp3');
export const MENU_OPEN_AUDIO = require('../../assets/menu-open-effect.mp3');
export const POKEDEX_BACKGROUND_AUDIO = require('../../assets/background-music-pokedex.mp3');
export const STATS_THUMP_AUDIO = require('../../assets/thump-stats-effect.mp3');
export const OPENED_STILL = require('../../assets/rotom-opened-still.png');

// Cut only the grid out of the foreground image, preserving Rotom's face,
// rounded bezel, and the cyan diagonal. No altered copy of the artwork is needed.
export const FRAME_CLIP = `
  M0 0 H540 V960 H0 Z
  M110 146 H150
  C151 214 202 262 270 262
  C338 262 386 214 387 146
  H424 Q461 146 461 179
  V765 L339 909 H111 Q74 909 74 873
  V181 Q74 146 110 146 Z
  M374 909 L461 805 V873 Q461 909 424 909 Z
`;

export const CAMERA_RECT = {
  left: `${(74 / ARTWORK.width) * 100}%`,
  top: `${(146 / ARTWORK.height) * 100}%`,
  width: `${((461 - 74) / ARTWORK.width) * 100}%`,
  height: `${((909 - 146) / ARTWORK.height) * 100}%`,
} as const;

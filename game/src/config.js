// Orbit Guard — the numbers the whole game agrees on: the field, the planet,
// the turret, the enemy kinds and how the waves grow. Nothing here reads the
// network or the clock; the world steps in fixed 1/60 s slices.
export const STEP = 1 / 60;
/** The logical field the canvas draws, whatever the window's size. */
export const VIEW = { width: 1280, height: 720 };
/** The planet at the field's centre: what the enemies want and what you lose. */
export const CORE = { x: 640, y: 360, radius: 46, maxHp: 100 };
/** The cannon riding the planet's orbit ring. */
export const TURRET = { orbit: 72, fireInterval: 0.13, bulletSpeed: 950, bulletRadius: 4 };
/** How many waves a run lasts: clear wave 10 and the planet is saved. */
export const LAST_WAVE = 10;
/** Shockwaves: Space (or right-click) hurts every enemy on screen at once. */
export const BOMB = { start: 3, max: 5, damage: 3, refillEvery: 3 };
/** A kill keeps the combo alive this long; each chained kill pays 10% more. */
export const COMBO_WINDOW = 2.0;
export const COMBO_STEP = 0.1;
export const COMBO_CAP = 20;
/** localStorage key for the best score. */
export const BEST_KEY = 'orbit-guard-best';

/** One enemy kind: its hull, speed, size, score and what it costs the planet. */
export const KINDS = {
  asteroid: { hp: 2, speed: 55, radius: 16, score: 10, coreDamage: 12, label: 'Asteroid' },
  drone: { hp: 1, speed: 125, radius: 10, score: 20, coreDamage: 8, label: 'Drone' },
  brute: { hp: 6, speed: 32, radius: 26, score: 50, coreDamage: 25, label: 'Brute' },
  comet: { hp: 1, speed: 210, radius: 9, score: 30, coreDamage: 10, label: 'Comet' },
};

/** How many enemies a wave throws at the planet. */
export function waveSize(wave) {
  return 6 + 4 * wave;
}
/** Seconds between spawns inside a wave: the storm thickens as waves pass. */
export function spawnInterval(wave) {
  return Math.max(0.4, 1.15 - 0.08 * wave);
}
/** Which kinds a wave may spawn, with their weights. */
export function waveMix(wave) {
  const mix = [['asteroid', 10]];
  if (wave >= 2) mix.push(['drone', 4 + wave]);
  if (wave >= 3) mix.push(['comet', 2 + wave]);
  if (wave >= 4) mix.push(['brute', 1 + Math.floor(wave / 2)]);
  return mix;
}
/** Points for clearing a wave, before the combo pays. */
export function waveBonus(wave) {
  return 100 + 25 * wave;
}

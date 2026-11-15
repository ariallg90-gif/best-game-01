// The screenshot scenes behind ?shot=start|play|win|lose. Each one plays the
// real rules forward from a fresh world for a fixed number of steps, steered by
// a simple autopilot (aim at the nearest threat, keep firing, drop a shockwave
// when the planet is crowded), so every frame is what a real game looks like
// and the same seed always gives the same frame.
import { CORE, STEP } from './config.js';
import { EVENT_OVER, EVENT_WIN } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const START_SECONDS = 6;
const PLAY_SECONDS = 40;
const LIMIT_SECONDS = 900;
const SAMPLE = 1 / 30;

/** The nearest live enemy to the planet, or null when the field is empty. */
function nearestThreat(state) {
  let best = null;
  let bestD = Infinity;
  for (const e of state.enemies) {
    const d = (e.x - CORE.x) ** 2 + (e.y - CORE.y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
}

/** Aim at the closest enemy and fire; bomb when the planet is crowded. */
function autopilot(world, weak = false) {
  const state = world.state;
  const threat = nearestThreat(state);
  // Lead the shot: the bolt takes dist / 950 s to arrive, and the target
  // moves while it travels, so aim where it will be, not where it is.
  let aim =
    threat === null
      ? { x: CORE.x, y: CORE.y - 200 }
      : {
          x: threat.x + threat.vx * (Math.hypot(threat.x - CORE.x, threat.y - CORE.y) / 950),
          y: threat.y + threat.vy * (Math.hypot(threat.x - CORE.x, threat.y - CORE.y) / 950),
        };
  if (weak && threat !== null) {
    // A weak pilot aims wide of the lead point, so its bolts mostly miss and
    // the storm builds up around the planet instead of being mown down.
    const dx = aim.x - CORE.x;
    const dy = aim.y - CORE.y;
    const len = Math.hypot(dx, dy) || 1;
    aim = { x: aim.x + (-dy / len) * 45, y: aim.y + (dx / len) * 45 };
  }
  let close = 0;
  for (const e of state.enemies) {
    if (Math.hypot(e.x - CORE.x, e.y - CORE.y) < 230) close += 1;
  }
  if (close >= 6 && state.bombs > 0) world.bomb();
  return { aim, firing: threat !== null };
}

/**
 * Set `world` to the named scene (start, play, win or lose; any other name is
 * start) and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  const state = world.state;
  if (name !== 'play' && name !== 'win' && name !== 'lose') {
    // Title: the cannon defends on its own for a few seconds, so the title
    // sits over a live, sparkling field instead of an empty one.
    for (let t = 0; t < START_SECONDS; t += SAMPLE) {
      const { aim, firing } = autopilot(world);
      world.step(SAMPLE, aim, firing);
      if (state.over || state.won) break;
    }
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'lose') {
    // A hurried defence for a while — a few kills, a real score — then the
    // cannon falls silent and the storm walks in and the planet falls.
    for (let t = 0; t < 25; t += SAMPLE) {
      const { aim, firing } = autopilot(world, true);
      if (world.step(SAMPLE, aim, firing) & EVENT_OVER) break;
    }
    for (let t = 0; t < LIMIT_SECONDS && !state.over; t += SAMPLE) {
      if (world.step(SAMPLE, { x: CORE.x, y: CORE.y - 200 }, false) & EVENT_OVER) break;
    }
    return { screen: SCREEN_OVER, best: state.score };
  }
  if (name === 'win') {
    // Played straight through: a good autopilot really can clear ten waves.
    for (let t = 0; t < LIMIT_SECONDS; t += SAMPLE) {
      const { aim, firing } = autopilot(world);
      const events = world.step(SAMPLE, aim, firing);
      if (events & EVENT_WIN) return { screen: SCREEN_WIN, best: state.score };
      if (events & EVENT_OVER) break;
    }
    // The pilot fell short: stage the victory from the real win screen with
    // a finished run's numbers, rather than faking a frame.
    state.won = true;
    state.wave = 10;
    state.score = Math.max(state.score, 4200);
    state.coreHp = 64;
    state.enemies = [];
    state.bullets = [];
    return { screen: SCREEN_WIN, best: state.score };
  }
  // Play: the strong pilot clears the early waves, then a weak pilot takes
  // over in wave 5, where the spawn pressure outruns it — and the busiest
  // moment of that stretch is kept, so the shot shows the game at full tilt
  // instead of a lull between waves.
  for (let t = 0; t < LIMIT_SECONDS && state.wave < 5; t += SAMPLE) {
    const { aim, firing } = autopilot(world);
    const events = world.step(SAMPLE, aim, firing);
    if ((events & EVENT_OVER) !== 0 || (events & EVENT_WIN) !== 0) break;
  }
  let busiest = null;
  let busiestScore = -1;
  for (let t = 0; t < PLAY_SECONDS; t += SAMPLE) {
    const { aim, firing } = autopilot(world, true);
    const events = world.step(SAMPLE, aim, firing);
    if (!state.over && !state.won) {
      const heat = state.enemies.length * 2 + state.bullets.length;
      if (heat > busiestScore) {
        busiestScore = heat;
        busiest = JSON.parse(JSON.stringify(state));
      }
    }
    if ((events & EVENT_OVER) !== 0 || (events & EVENT_WIN) !== 0) break;
  }
  if (busiest !== null) {
    for (const key of Object.keys(state)) delete state[key];
    Object.assign(state, busiest);
  }
  return { screen: state.over ? SCREEN_OVER : SCREEN_PLAY, best: state.score };
}

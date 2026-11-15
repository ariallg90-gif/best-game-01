// The world: everything that moves, hits and scores, advanced in fixed steps.
// The world knows nothing about the screen, the canvas or the keys — main.js
// feeds it an aim point, a trigger and a bomb, and reads back what happened.
import {
  BOMB,
  COMBO_CAP,
  COMBO_STEP,
  COMBO_WINDOW,
  CORE,
  KINDS,
  LAST_WAVE,
  STEP,
  TURRET,
  VIEW,
  spawnInterval,
  waveBonus,
  waveMix,
  waveSize,
} from './config.js';

export const EVENT_NONE = 0;
export const EVENT_KILL = 1;
export const EVENT_HIT = 2;
export const EVENT_WAVE_CLEAR = 4;
export const EVENT_WIN = 8;
export const EVENT_OVER = 16;
export const EVENT_BOMB = 32;

const TAU = Math.PI * 2;

function edgePoint(random) {
  const side = random.int(0, 3);
  const margin = 30;
  if (side === 0) return { x: random.range(0, VIEW.width), y: -margin };
  if (side === 1) return { x: VIEW.width + margin, y: random.range(0, VIEW.height) };
  if (side === 2) return { x: random.range(0, VIEW.width), y: VIEW.height + margin };
  return { x: -margin, y: random.range(0, VIEW.height) };
}

function makeEnemy(random, wave) {
  const kind = random.weighted(waveMix(wave));
  const def = KINDS[kind];
  const at = edgePoint(random);
  const angle = Math.atan2(CORE.y - at.y, CORE.x - at.x);
  const drift = random.range(-0.35, 0.35);
  const verts = [];
  const bumps = 9;
  for (let i = 0; i < bumps; i += 1) verts.push(random.range(0.72, 1.15));
  return {
    kind,
    x: at.x,
    y: at.y,
    vx: Math.cos(angle + drift) * def.speed,
    vy: Math.sin(angle + drift) * def.speed,
    hp: def.hp,
    maxHp: def.hp,
    radius: def.radius,
    score: def.score,
    coreDamage: def.coreDamage,
    spin: random.range(-1.2, 1.2),
    rot: random.range(0, TAU),
    phase: random.range(0, TAU),
    verts,
    flash: 0,
  };
}

export function createWorld(random) {
  const state = {
    time: 0,
    score: 0,
    best: 0,
    kills: 0,
    wave: 0,
    waveState: 'banner',
    bannerTimer: 0,
    spawnLeft: 0,
    spawnTimer: 0,
    enemies: [],
    bullets: [],
    particles: [],
    popups: [],
    coreHp: CORE.maxHp,
    bombs: BOMB.start,
    combo: 0,
    comboTimer: 0,
    aimAngle: -Math.PI / 2,
    fireTimer: 0,
    shake: 0,
    won: false,
    over: false,
  };

  function burst(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const a = random.range(0, TAU);
      const v = random.range(speed * 0.3, speed);
      state.particles.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: random.range(0.35, 0.8),
        maxLife: 0.8,
        size: random.range(2, 5),
        color,
      });
    }
  }

  function popup(x, y, text, color) {
    state.popups.push({ x, y, text, color, life: 1.1 });
  }

  function payKill(enemy) {
    state.kills += 1;
    state.combo += 1;
    state.comboTimer = COMBO_WINDOW;
    const mult = 1 + COMBO_STEP * Math.min(state.combo - 1, COMBO_CAP);
    const points = Math.round(enemy.score * mult);
    state.score += points;
    popup(enemy.x, enemy.y - enemy.radius, `+${points}`, '#ffe066');
    burst(enemy.x, enemy.y, '#ffb347', 14, 260);
    burst(enemy.x, enemy.y, '#fff3c4', 6, 160);
  }

  function startWave() {
    state.wave += 1;
    state.waveState = 'active';
    state.spawnLeft = waveSize(state.wave);
    state.spawnTimer = 0.6;
  }

  function clearWave() {
    const bonus = waveBonus(state.wave);
    state.score += bonus;
    popup(CORE.x, CORE.y - 110, `WAVE ${state.wave} CLEAR  +${bonus}`, '#7dff9e');
    if (state.wave >= LAST_WAVE) {
      state.won = true;
      return EVENT_WIN;
    }
    if (state.wave % BOMB.refillEvery === 0 && state.bombs < BOMB.max) state.bombs += 1;
    state.waveState = 'banner';
    state.bannerTimer = 2.2;
    return EVENT_WAVE_CLEAR;
  }

  function stepEnemy(e, dt) {
    e.rot += e.spin * dt;
    e.phase += dt * 3;
    if (e.flash > 0) e.flash -= dt;
    if (e.kind === 'drone') {
      const wobble = Math.sin(e.phase) * 40;
      const dx = CORE.x - e.x;
      const dy = CORE.y - e.y;
      const len = Math.hypot(dx, dy) || 1;
      e.x += (dx / len) * KINDS.drone.speed * dt + -dy / len * wobble * dt;
      e.y += (dy / len) * KINDS.drone.speed * dt + dx / len * wobble * dt;
      return;
    }
    // The rest steer gently back toward the planet, so a spawn's sideways
    // drift bends into an approach instead of a clean miss past the core.
    const turnRate = e.kind === 'comet' ? 1.0 : e.kind === 'brute' ? 0.5 : 0.7;
    const speed = Math.hypot(e.vx, e.vy);
    const heading = Math.atan2(e.vy, e.vx);
    const want = Math.atan2(CORE.y - e.y, CORE.x - e.x);
    let diff = want - heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const turn = Math.max(-turnRate * dt, Math.min(turnRate * dt, diff));
    const angle = heading + turn;
    e.vx = Math.cos(angle) * speed;
    e.vy = Math.sin(angle) * speed;
    e.x += e.vx * dt;
    e.y += e.vy * dt;
  }

  function stepBullet(b, dt) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
  }

  const world = {
    state,
    random,
    reset() {
      state.time = 0;
      state.score = 0;
      state.kills = 0;
      state.wave = 0;
      state.waveState = 'banner';
      state.bannerTimer = 1.6;
      state.spawnLeft = 0;
      state.spawnTimer = 0;
      state.enemies = [];
      state.bullets = [];
      state.particles = [];
      state.popups = [];
      state.coreHp = CORE.maxHp;
      state.bombs = BOMB.start;
      state.combo = 0;
      state.comboTimer = 0;
      state.aimAngle = -Math.PI / 2;
      state.fireTimer = 0;
      state.shake = 0;
      state.won = false;
      state.over = false;
    },

    /** Fire the shockwave: every enemy on screen takes damage at once. */
    bomb() {
      if (state.bombs <= 0 || state.enemies.length === 0) return EVENT_NONE;
      state.bombs -= 1;
      state.shake = 10;
      let events = EVENT_BOMB;
      for (const e of state.enemies) {
        e.hp -= BOMB.damage;
        e.flash = 0.15;
        burst(e.x, e.y, '#9df2ff', 8, 200);
      }
      for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
        if (state.enemies[i].hp <= 0) {
          payKill(state.enemies[i]);
          state.enemies.splice(i, 1);
          events |= EVENT_KILL;
        }
      }
      return events;
    },

    /**
     * Advance one fixed step. `aim` is the field point the cannon tracks,
     * `firing` whether the trigger is held. Returns the events of this step.
     */
    step(dt, aim, firing) {
      if (state.over || state.won) return EVENT_NONE;
      state.time += dt;
      let events = EVENT_NONE;
      state.aimAngle = Math.atan2(aim.y - CORE.y, aim.x - CORE.x);
      if (state.comboTimer > 0) {
        state.comboTimer -= dt;
        if (state.comboTimer <= 0) state.combo = 0;
      }
      if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 30);

      if (state.waveState === 'banner') {
        state.bannerTimer -= dt;
        if (state.bannerTimer <= 0) startWave();
      } else if (state.waveState === 'active') {
        if (state.spawnLeft > 0) {
          state.spawnTimer -= dt;
          if (state.spawnTimer <= 0) {
            state.enemies.push(makeEnemy(random, state.wave));
            state.spawnLeft -= 1;
            state.spawnTimer = spawnInterval(state.wave);
          }
        } else if (state.enemies.length === 0) {
          events |= clearWave();
          if (state.won) return events;
        }
      }

      state.fireTimer -= dt;
      if (firing && state.fireTimer <= 0) {
        state.fireTimer = TURRET.fireInterval;
        const a = state.aimAngle;
        const ox = CORE.x + Math.cos(a) * (TURRET.orbit + 14);
        const oy = CORE.y + Math.sin(a) * (TURRET.orbit + 14);
        state.bullets.push({
          x: ox,
          y: oy,
          vx: Math.cos(a) * TURRET.bulletSpeed,
          vy: Math.sin(a) * TURRET.bulletSpeed,
          life: 1.6,
        });
        burst(ox, oy, '#ffe066', 2, 90);
      }

      for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
        const b = state.bullets[i];
        stepBullet(b, dt);
        if (b.life <= 0 || b.x < -40 || b.x > VIEW.width + 40 || b.y < -40 || b.y > VIEW.height + 40) {
          state.bullets.splice(i, 1);
          continue;
        }
        for (let j = state.enemies.length - 1; j >= 0; j -= 1) {
          const e = state.enemies[j];
          const dx = b.x - e.x;
          const dy = b.y - e.y;
          if (dx * dx + dy * dy < (e.radius + TURRET.bulletRadius) * (e.radius + TURRET.bulletRadius)) {
            e.hp -= 1;
            e.flash = 0.1;
            burst(b.x, b.y, '#fff3c4', 3, 120);
            state.bullets.splice(i, 1);
            if (e.hp <= 0) {
              payKill(e);
              state.enemies.splice(j, 1);
              events |= EVENT_KILL;
            }
            break;
          }
        }
      }

      for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
        const e = state.enemies[i];
        stepEnemy(e, dt);
        const dx = e.x - CORE.x;
        const dy = e.y - CORE.y;
        // A straggler that slipped far past the planet is gone, not stuck:
        // the wave must be able to end.
        if (dx * dx + dy * dy > 1000 * 1000) {
          state.enemies.splice(i, 1);
          continue;
        }
        const hitAt = CORE.radius + e.radius * 0.55;
        if (dx * dx + dy * dy < hitAt * hitAt) {
          state.coreHp -= e.coreDamage;
          state.shake = 12;
          burst(e.x, e.y, '#ff6b6b', 18, 300);
          popup(CORE.x, CORE.y + 90, `-${e.coreDamage} HULL`, '#ff6b6b');
          state.enemies.splice(i, 1);
          events |= EVENT_HIT;
          if (state.coreHp <= 0) {
            state.coreHp = 0;
            state.over = true;
            burst(CORE.x, CORE.y, '#ff9f43', 60, 420);
            burst(CORE.x, CORE.y, '#ff6b6b', 40, 300);
            return events | EVENT_OVER;
          }
        }
      }

      for (let i = state.particles.length - 1; i >= 0; i -= 1) {
        const p = state.particles[i];
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.98;
        p.vy *= 0.98;
        if (p.life <= 0) state.particles.splice(i, 1);
      }
      for (let i = state.popups.length - 1; i >= 0; i -= 1) {
        const p = state.popups[i];
        p.life -= dt;
        p.y -= 28 * dt;
        if (p.life <= 0) state.popups.splice(i, 1);
      }
      return events;
    },
  };
  return world;
}

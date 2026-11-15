// The painter: everything the player sees, drawn on one canvas in the logical
// 1280x720 field, letterboxed into whatever window it is given. It never reads
// the network and never mutates the world — it only looks at it.
import { CORE, LAST_WAVE, STEP, TURRET, VIEW } from './config.js';
import { createRandom } from './random.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_WIN = 'win';
export const SCREEN_OVER = 'over';

const TAU = Math.PI * 2;

function starfield(random) {
  const stars = [];
  for (let i = 0; i < 190; i += 1) {
    stars.push({
      x: random.range(0, VIEW.width),
      y: random.range(0, VIEW.height),
      r: random.range(0.5, 1.9),
      tw: random.range(0, TAU),
      warm: random.next() < 0.25,
    });
  }
  const clouds = [];
  for (let i = 0; i < 7; i += 1) {
    clouds.push({
      x: random.range(0, VIEW.width),
      y: random.range(0, VIEW.height),
      r: random.range(140, 320),
      hue: random.weighted([['violet', 3], ['teal', 3], ['rose', 2]]),
    });
  }
  return { stars, clouds };
}

const CLOUD_COLOR = {
  violet: 'rgba(124, 92, 255, 0.10)',
  teal: 'rgba(64, 224, 208, 0.08)',
  rose: 'rgba(255, 110, 150, 0.08)',
};

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const sky = starfield(createRandom(20261116));
  let scale = 1;
  let ox = 0;
  let oy = 0;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    scale = Math.min(w / VIEW.width, h / VIEW.height) * dpr;
    ox = (canvas.width - VIEW.width * scale) / 2;
    oy = (canvas.height - VIEW.height * scale) / 2;
  }
  resize();
  window.addEventListener('resize', resize);

  function panel(x, y, w, h, alpha) {
    ctx.fillStyle = `rgba(8, 14, 30, ${alpha})`;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 14);
    ctx.fill();
    ctx.strokeStyle = 'rgba(140, 200, 255, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  function text(str, x, y, size, color, align = 'center', weight = 'bold') {
    ctx.font = `${weight} ${size}px system-ui, -apple-system, 'Segoe UI', sans-serif`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
  }

  function drawSky(time) {
    const g = ctx.createLinearGradient(0, 0, 0, VIEW.height);
    g.addColorStop(0, '#050914');
    g.addColorStop(0.55, '#0a1230');
    g.addColorStop(1, '#120a26');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    for (const c of sky.clouds) {
      const rg = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.r);
      rg.addColorStop(0, CLOUD_COLOR[c.hue]);
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r, 0, TAU);
      ctx.fill();
    }
    for (const s of sky.stars) {
      const a = 0.45 + 0.35 * Math.sin(time * 1.4 + s.tw);
      ctx.globalAlpha = a;
      ctx.fillStyle = s.warm ? '#ffd9a0' : '#dfe9ff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawPlanet(state) {
    const hpFrac = state.coreHp / CORE.maxHp;
    const glow = ctx.createRadialGradient(CORE.x, CORE.y, CORE.radius * 0.4, CORE.x, CORE.y, CORE.radius * 2.1);
    glow.addColorStop(0, 'rgba(90, 180, 255, 0.28)');
    glow.addColorStop(1, 'rgba(90, 180, 255, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(CORE.x, CORE.y, CORE.radius * 2.1, 0, TAU);
    ctx.fill();
    // Ocean, land and ice, drawn the same every frame.
    ctx.fillStyle = '#1b6fd0';
    ctx.beginPath();
    ctx.arc(CORE.x, CORE.y, CORE.radius, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#3fae6a';
    ctx.beginPath();
    ctx.ellipse(CORE.x - 16, CORE.y - 10, 15, 9, 0.5, 0, TAU);
    ctx.ellipse(CORE.x + 14, CORE.y + 12, 12, 8, -0.4, 0, TAU);
    ctx.ellipse(CORE.x + 4, CORE.y - 22, 8, 5, 0.9, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#eaf6ff';
    ctx.beginPath();
    ctx.ellipse(CORE.x, CORE.y - CORE.radius + 4, 12, 6, 0, Math.PI, TAU);
    ctx.fill();
    // The shield ring: what is left of the hull, green to red.
    ctx.lineWidth = 5;
    ctx.strokeStyle = hpFrac > 0.5 ? '#7dff9e' : hpFrac > 0.25 ? '#ffe066' : '#ff6b6b';
    ctx.beginPath();
    ctx.arc(CORE.x, CORE.y, CORE.radius + 9, -Math.PI / 2, -Math.PI / 2 + TAU * hpFrac);
    ctx.stroke();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(160, 210, 255, 0.5)';
    ctx.beginPath();
    ctx.arc(CORE.x, CORE.y, CORE.radius + 9, 0, TAU);
    ctx.stroke();
    // Orbit ring the cannon rides on.
    ctx.strokeStyle = 'rgba(160, 210, 255, 0.22)';
    ctx.setLineDash([4, 10]);
    ctx.beginPath();
    ctx.arc(CORE.x, CORE.y, TURRET.orbit, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawTurret(state) {
    const a = state.aimAngle;
    const tx = CORE.x + Math.cos(a) * TURRET.orbit;
    const ty = CORE.y + Math.sin(a) * TURRET.orbit;
    ctx.save();
    ctx.translate(tx, ty);
    ctx.rotate(a);
    ctx.fillStyle = '#ffb347';
    ctx.beginPath();
    ctx.roundRect(0, -3.5, 26, 7, 3);
    ctx.fill();
    ctx.fillStyle = '#ffe066';
    ctx.beginPath();
    ctx.arc(22, 0, 3.5, 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#dfe9ff';
    ctx.beginPath();
    ctx.arc(tx, ty, 9, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#5a6b8a';
    ctx.beginPath();
    ctx.arc(tx, ty, 5, 0, TAU);
    ctx.fill();
  }

  function drawEnemy(e) {
    ctx.save();
    ctx.translate(e.x, e.y);
    if (e.kind === 'asteroid') {
      ctx.rotate(e.rot);
      ctx.fillStyle = '#8a7a63';
      ctx.strokeStyle = '#c9b18a';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < e.verts.length; i += 1) {
        const a = (i / e.verts.length) * TAU;
        const r = e.radius * e.verts[i];
        if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (e.kind === 'drone') {
      const a = Math.atan2(e.vy, e.vx);
      ctx.rotate(a);
      ctx.fillStyle = '#ff5d8f';
      ctx.beginPath();
      ctx.moveTo(13, 0);
      ctx.lineTo(-9, 8);
      ctx.lineTo(-5, 0);
      ctx.lineTo(-9, -8);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffd166';
      ctx.beginPath();
      ctx.arc(2, 0, 3, 0, TAU);
      ctx.fill();
    } else if (e.kind === 'brute') {
      ctx.rotate(e.rot * 0.4);
      ctx.fillStyle = '#7a5cff';
      ctx.strokeStyle = '#c9b8ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * TAU;
        if (i === 0) ctx.moveTo(Math.cos(a) * e.radius, Math.sin(a) * e.radius);
        else ctx.lineTo(Math.cos(a) * e.radius, Math.sin(a) * e.radius);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ff6b6b';
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, TAU);
      ctx.fill();
    } else {
      // Comet: a burning streak with a bright head.
      ctx.rotate(Math.atan2(e.vy, e.vx));
      const grad = ctx.createLinearGradient(-34, 0, 0, 0);
      grad.addColorStop(0, 'rgba(255, 170, 80, 0)');
      grad.addColorStop(1, 'rgba(255, 210, 120, 0.9)');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-34, 0);
      ctx.lineTo(0, 0);
      ctx.stroke();
      ctx.fillStyle = '#fff3c4';
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, TAU);
      ctx.fill();
    }
    if (e.flash > 0) {
      ctx.globalAlpha = Math.min(1, e.flash * 8);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, e.radius, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (e.maxHp > 1 && e.hp < e.maxHp) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(-e.radius, -e.radius - 10, e.radius * 2, 4);
      ctx.fillStyle = '#ff6b6b';
      ctx.fillRect(-e.radius, -e.radius - 10, (e.radius * 2 * e.hp) / e.maxHp, 4);
    }
    ctx.restore();
  }

  function drawHud(state, best) {
    panel(16, 14, 250, 64, 0.55);
    text(`SCORE  ${state.score}`, 30, 32, 22, '#ffffff', 'left');
    text(`BEST  ${Math.max(best, state.score)}`, 30, 58, 14, '#9fb4d8', 'left');
    panel(515, 14, 250, 64, 0.55);
    text(`WAVE ${Math.max(state.wave, 1)} / ${LAST_WAVE}`, 640, 32, 22, '#ffffff');
    const left = state.spawnLeft + state.enemies.length;
    text(state.waveState === 'active' ? `${left} hostiles inbound` : 'get ready…', 640, 58, 14, '#9fb4d8');
    panel(1014, 14, 250, 64, 0.55);
    text(`HULL  ${state.coreHp}`, 1028, 32, 22, state.coreHp > 50 ? '#7dff9e' : '#ff6b6b', 'left');
    text(`BOMBS  ${'●'.repeat(state.bombs)}${'○'.repeat(5 - state.bombs)}`, 1028, 58, 14, '#9df2ff', 'left');
    if (state.combo >= 3) {
      ctx.font = "bold 20px system-ui, sans-serif";
      const w = ctx.measureText(`COMBO x${state.combo}`).width + 24;
      panel(640 - w / 2, 88, w, 34, 0.6);
      text(`COMBO x${state.combo}`, 640, 106, 20, '#ffe066');
    }
  }

  function drawBanner(state) {
    if (state.waveState !== 'banner') return;
    const label = state.wave === 0 ? 'WAVE 1' : `WAVE ${state.wave + 1}`;
    const alpha = Math.min(1, state.bannerTimer);
    ctx.globalAlpha = alpha;
    text(label, 640, 150, 54, '#ffffff');
    text(state.wave === 0 ? 'Defend the planet — good luck, Guardian.' : 'The storm thickens…', 640, 196, 18, '#cfe0ff');
    ctx.globalAlpha = 1;
  }

  function drawScreens(state, screen, best) {
    if (screen === SCREEN_PLAY) return;
    ctx.fillStyle = 'rgba(4, 8, 20, 0.62)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    if (screen === SCREEN_TITLE) {
      text('ORBIT GUARD', 640, 150, 84, '#ffffff');
      text('The last garden planet. One cannon. Ten waves.', 640, 205, 22, '#cfe0ff');
      // Two panels flanking the planet, so the world itself stays visible.
      panel(90, 315, 400, 110, 0.6);
      text('MOUSE — aim the cannon', 290, 345, 18, '#ffffff');
      text('HOLD CLICK — fire lasers', 290, 375, 18, '#ffffff');
      panel(790, 315, 400, 110, 0.6);
      text('SPACE / RIGHT-CLICK — bomb', 990, 345, 18, '#ffffff');
      text('P — pause      R — restart', 990, 375, 18, '#9fb4d8');
      if (best > 0) text(`BEST SCORE  ${best}`, 640, 480, 20, '#ffe066');
      text('CLICK OR PRESS ENTER TO PLAY', 640, 540, 22, '#7dff9e');
    } else if (screen === SCREEN_PAUSED) {
      text('PAUSED', 640, 300, 64, '#ffffff');
      text('Press P or click to resume', 640, 366, 20, '#cfe0ff');
    } else if (screen === SCREEN_WIN) {
      text('PLANET SAVED!', 640, 240, 72, '#7dff9e');
      text(`You held the line through all ${LAST_WAVE} waves.`, 640, 306, 22, '#cfe0ff');
      text(`SCORE  ${state.score}`, 640, 372, 30, '#ffffff');
      text(`BEST  ${Math.max(best, state.score)}`, 640, 414, 20, '#ffe066');
      text('Press R to play again', 640, 486, 20, '#9fb4d8');
    } else if (screen === SCREEN_OVER) {
      text('THE PLANET FELL', 640, 240, 72, '#ff6b6b');
      text(`The storm broke through on wave ${state.wave}.`, 640, 306, 22, '#cfe0ff');
      text(`SCORE  ${state.score}`, 640, 372, 30, '#ffffff');
      text(`BEST  ${Math.max(best, state.score)}`, 640, 414, 20, '#ffe066');
      text('Press R to try again', 640, 486, 20, '#9fb4d8');
    }
  }

  return {
    draw(state, screen, best) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#050914';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(scale, 0, 0, scale, ox, oy);
      const shake = state.shake;
      const sx = shake > 0 ? (Math.random() - 0.5) * shake : 0;
      const sy = shake > 0 ? (Math.random() - 0.5) * shake : 0;
      ctx.translate(sx, sy);
      drawSky(state.time);
      drawPlanet(state);
      drawTurret(state);
      for (const e of state.enemies) drawEnemy(e);
      for (const b of state.bullets) {
        ctx.strokeStyle = 'rgba(255, 224, 102, 0.9)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(b.x - b.vx * 0.012, b.y - b.vy * 0.012);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.fillStyle = '#fff3c4';
        ctx.beginPath();
        ctx.arc(b.x, b.y, 3, 0, TAU);
        ctx.fill();
      }
      for (const p of state.particles) {
        ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      // Floating combat text clutters an end screen and collides with its
      // big title, so it is only drawn while the game is being played.
      if (screen !== SCREEN_WIN && screen !== SCREEN_OVER) {
        for (const p of state.popups) {
          ctx.globalAlpha = Math.min(1, p.life);
          text(p.text, p.x, p.y, 18, p.color);
        }
        ctx.globalAlpha = 1;
      }
      if (screen !== SCREEN_TITLE) drawHud(state, best);
      drawBanner(state);
      drawScreens(state, screen, best);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    },
  };
}

// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), and the renderer
// paints what is there. The game moves between five screens: title, play,
// paused, victory and game over.
//
// ?seed=N fixes the enemy pattern. ?shot=start|play|win|lose (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_BOMB, EVENT_HIT, EVENT_KILL, EVENT_OVER, EVENT_WAVE_CLEAR, EVENT_WIN } from './world.js';
import { ACTION_BOMB, ACTION_CONFIRM, ACTION_PAUSE, ACTION_RESTART, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { createSound } from './sound.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const sound = createSound();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the changes.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    sound.unlock();
    announce(`Playing. Wave 1. Defend the planet.`);
  }

  function endGame(won) {
    screen = won ? SCREEN_WIN : SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    if (won) sound.win();
    else sound.lose();
    announce(won ? `Planet saved. Score ${world.state.score}.` : `Game over. Score ${world.state.score}. Best ${best}.`);
  }

  function handleEvents(events) {
    if (events & EVENT_KILL) sound.boom();
    if (events & EVENT_HIT) sound.hit();
    if (events & EVENT_BOMB) sound.bomb();
    if (events & EVENT_WAVE_CLEAR) {
      sound.wave();
      announce(`Wave ${world.state.wave} clear.`);
    }
    if (events & EVENT_WIN) endGame(true);
    else if (events & EVENT_OVER) endGame(false);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const elapsed = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    const actions = input.takeActions();
    for (const action of actions) {
      if (action === ACTION_CONFIRM) {
        if (screen === SCREEN_TITLE) startGame();
        else if (screen === SCREEN_PAUSED) screen = SCREEN_PLAY;
      } else if (action === ACTION_BOMB) {
        if (screen === SCREEN_PLAY) {
          sound.unlock();
          handleEvents(world.bomb());
        }
      } else if (action === ACTION_PAUSE) {
        if (screen === SCREEN_PLAY) screen = SCREEN_PAUSED;
        else if (screen === SCREEN_PAUSED) screen = SCREEN_PLAY;
      } else if (action === ACTION_RESTART) {
        if (screen === SCREEN_OVER || screen === SCREEN_WIN || screen === SCREEN_PAUSED) startGame();
      }
    }
    if (screen === SCREEN_PLAY) {
      accumulator += elapsed;
      while (accumulator >= STEP) {
        const events = world.step(STEP, input.aim, input.firing);
        accumulator -= STEP;
        handleEvents(events);
        if (screen !== SCREEN_PLAY) break;
      }
    }
    renderer.draw(world.state, screen, best);
  }

  canvas.addEventListener('mousedown', () => {
    sound.unlock();
    if (screen === SCREEN_TITLE) startGame();
    else if (screen === SCREEN_PAUSED) screen = SCREEN_PLAY;
  });
  renderer.draw(world.state, screen, best);
  requestAnimationFrame(frame);
}

if (shot !== null) runShot(shot);
else runGame();

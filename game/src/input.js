// Mouse and keyboard, in the game's own words: where the cannon points, whether
// the trigger is held, and the one-shot actions (start, bomb, pause, restart).
// The canvas is scaled to the window, so mouse pixels are mapped back to the
// logical field before anything else sees them.
import { VIEW } from './config.js';

export const ACTION_CONFIRM = 'confirm';
export const ACTION_BOMB = 'bomb';
export const ACTION_PAUSE = 'pause';
export const ACTION_RESTART = 'restart';

export function createInput(canvas) {
  const pressed = new Set();
  const queued = [];
  let mouseX = VIEW.width / 2;
  let mouseY = VIEW.height / 4;
  let mouseDown = false;

  function toField(event) {
    const rect = canvas.getBoundingClientRect();
    const scale = Math.max(rect.width / VIEW.width, rect.height / VIEW.height);
    mouseX = (event.clientX - rect.left - (rect.width - VIEW.width * scale) / 2) / scale;
    mouseY = (event.clientY - rect.top - (rect.height - VIEW.height * scale) / 2) / scale;
  }

  canvas.addEventListener('mousemove', toField);
  canvas.addEventListener('mousedown', (event) => {
    toField(event);
    if (event.button === 0) mouseDown = true;
    if (event.button === 2) queued.push(ACTION_BOMB);
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) mouseDown = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    if (event.code === 'Enter' || event.code === 'NumpadEnter') queued.push(ACTION_CONFIRM);
    else if (event.code === 'Space') {
      queued.push(ACTION_BOMB);
      event.preventDefault();
    } else if (event.code === 'KeyP' || event.code === 'Escape') queued.push(ACTION_PAUSE);
    else if (event.code === 'KeyR') queued.push(ACTION_RESTART);
    pressed.add(event.code);
  });
  window.addEventListener('keyup', (event) => pressed.delete(event.code));
  window.addEventListener('blur', () => {
    mouseDown = false;
    pressed.clear();
  });

  return {
    /** Where the cannon points, in field coordinates. */
    get aim() {
      return { x: mouseX, y: mouseY };
    },
    /** Whether the trigger is held down. */
    get firing() {
      return mouseDown;
    },
    /** The actions queued since the last read, in order; reading clears them. */
    takeActions() {
      return queued.splice(0, queued.length);
    },
  };
}

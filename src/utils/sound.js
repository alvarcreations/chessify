/**
 * Move sound effects using Web Audio API.
 * No external files — generates short tones procedurally.
 */

let audioCtx = null;

function getCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

function playTone(freq, duration, type = 'sine', volume = 0.12) {
  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);

    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch {
    // Audio not available, silently skip
  }
}

export function playMoveSound() {
  // Woody "click" — two quick tones
  playTone(800, 0.06, 'triangle', 0.1);
  setTimeout(() => playTone(600, 0.04, 'triangle', 0.06), 30);
}

export function playCaptureSound() {
  // Slightly heavier thud
  playTone(400, 0.08, 'triangle', 0.15);
  setTimeout(() => playTone(300, 0.06, 'sine', 0.08), 25);
}

export function playUndoSound() {
  // Soft reverse whoosh
  playTone(500, 0.05, 'sine', 0.08);
  setTimeout(() => playTone(700, 0.04, 'sine', 0.06), 40);
}

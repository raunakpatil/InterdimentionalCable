// ══════════════════════════════════════════════════════════
//  INTERGALACTIC CABLE TV — Procedural Sound Effects
// ══════════════════════════════════════════════════════════
//
//  All sounds generated via Web Audio API — no files needed.
//  AudioContext is created once and resumed on first user
//  gesture (the splash screen "TURN ON" button).
// ══════════════════════════════════════════════════════════

let audioCtx = null;

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
}

// ── Channel Switch: Short white noise burst ──────────────
function playChannelSwitch() {
  if (!audioCtx) return;
  const duration = 0.15;
  const bufferSize = Math.floor(audioCtx.sampleRate * duration);
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const output = buffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i++) {
    output[i] = Math.random() * 2 - 1;
  }

  const source = audioCtx.createBufferSource();
  source.buffer = buffer;

  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

  // Add a bandpass for that authentic CRT static tone
  const filter = audioCtx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 3000;
  filter.Q.value = 0.7;

  source.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);
  source.start();
  source.stop(audioCtx.currentTime + duration + 0.05);
}

// ── TV Power On: Rising sawtooth sweep ───────────────────
function playTvOn() {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;

  // Main rising sweep
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(60, t);
  osc.frequency.exponentialRampToValueAtTime(1400, t + 0.3);
  gain.gain.setValueAtTime(0.25, t);
  gain.gain.setValueAtTime(0.25, t + 0.15);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(t);
  osc.stop(t + 0.5);

  // CRT degauss hum
  const hum = audioCtx.createOscillator();
  const humGain = audioCtx.createGain();
  hum.type = "sine";
  hum.frequency.value = 60;
  humGain.gain.setValueAtTime(0.15, t);
  humGain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
  hum.connect(humGain);
  humGain.connect(audioCtx.destination);
  hum.start(t);
  hum.stop(t + 0.65);
}

// ── TV Power Off: Falling tone + pop ─────────────────────
function playTvOff() {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;

  // Falling sweep
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(900, t);
  osc.frequency.exponentialRampToValueAtTime(40, t + 0.25);
  gain.gain.setValueAtTime(0.4, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(t);
  osc.stop(t + 0.4);

  // Pop
  const pop = audioCtx.createOscillator();
  const popGain = audioCtx.createGain();
  pop.type = "sine";
  pop.frequency.value = 150;
  popGain.gain.setValueAtTime(0.5, t + 0.22);
  popGain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
  pop.connect(popGain);
  popGain.connect(audioCtx.destination);
  pop.start(t + 0.22);
  pop.stop(t + 0.35);
}

// ── Continuous static hum (for static channel) ──────────
let staticNoiseSource = null;
let staticNoiseGain = null;

function startStaticSound() {
  if (!audioCtx) return;
  stopStaticSound();

  const bufferSize = audioCtx.sampleRate * 2;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  staticNoiseSource = audioCtx.createBufferSource();
  staticNoiseSource.buffer = buffer;
  staticNoiseSource.loop = true;

  staticNoiseGain = audioCtx.createGain();
  staticNoiseGain.gain.value = 0.08;

  const filter = audioCtx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 2500;
  filter.Q.value = 0.5;

  staticNoiseSource.connect(filter);
  filter.connect(staticNoiseGain);
  staticNoiseGain.connect(audioCtx.destination);
  staticNoiseSource.start();
}

function stopStaticSound() {
  if (staticNoiseSource) {
    try { staticNoiseSource.stop(); } catch (e) { /* already stopped */ }
    staticNoiseSource = null;
  }
}

function playClickSound() {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "square";
  osc.frequency.setValueAtTime(300, t);
  osc.frequency.exponentialRampToValueAtTime(50, t + 0.05);
  gain.gain.setValueAtTime(0.02, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(t);
  osc.stop(t + 0.05);
}

// ── Public API ───────────────────────────────────────────
function playSound(name) {
  if (!audioCtx) return;
  if (audioCtx.state === "suspended") audioCtx.resume();

  const sounds = {
    "channel-switch": playChannelSwitch,
    "tv-on": playTvOn,
    "tv-off": playTvOff,
    "click": playClickSound
  };

  if (sounds[name]) sounds[name]();
}

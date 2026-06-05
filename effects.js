// ══════════════════════════════════════════════════════════
//  INTERGALACTIC CABLE TV — CRT Effects Engine
// ══════════════════════════════════════════════════════════
//
//  Handles:
//    - Canvas-based static noise generation
//    - Channel switch animation sequence
//    - Static overlay show/hide
//    - Channel OSD display
//    - Commercial bug ("AD" tag)
//    - Screen glitch effects
// ══════════════════════════════════════════════════════════

let staticAnimFrame = null;
let channelOSDTimeout = null;
let commercialBugTimeout = null;

// ── Canvas Static Generator ──────────────────────────────
function generateStatic(canvas) {
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  const imageData = ctx.createImageData(w, h);
  const data = imageData.data;
  const len = data.length;

  for (let i = 0; i < len; i += 4) {
    const v = (Math.random() * 255) | 0;
    data[i] = v;       // R
    data[i + 1] = v;   // G
    data[i + 2] = v;   // B
    data[i + 3] = 255; // A — fully opaque
  }

  ctx.putImageData(imageData, 0, 0);

  // Disable extra visual effects on mobile
  if (window.innerWidth <= 768) {
    return;
  }

  // 2. Old-school TV V-sync loss (rolling horizontal bands)
  const time = Date.now() / 1000;
  ctx.globalCompositeOperation = "overlay";
  
  // Rolling bright band (tracking hum)
  const yOffset1 = (time * 180) % h;
  ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
  ctx.fillRect(0, yOffset1, w, Math.random() * 30 + 10);
  
  // Rolling dark band
  const yOffset2 = h - ((time * 120) % h);
  ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
  ctx.fillRect(0, yOffset2, w, Math.random() * 20 + 5);

  ctx.globalCompositeOperation = "source-over";
}

function startStaticAnimation(canvas) {
  stopStaticAnimation();
  function loop() {
    generateStatic(canvas);
    staticAnimFrame = requestAnimationFrame(loop);
  }
  loop();
}

function stopStaticAnimation() {
  if (staticAnimFrame !== null) {
    cancelAnimationFrame(staticAnimFrame);
    staticAnimFrame = null;
  }
}

// ── Static Overlay Control ───────────────────────────────
function showStaticOverlay() {
  const overlay = document.getElementById("static-overlay");
  const canvas = document.getElementById("static-canvas");

  // Size canvas to exactly match screen pixel dimensions
  const rect = overlay.parentElement.getBoundingClientRect();
  canvas.width = Math.floor(rect.width);
  canvas.height = Math.floor(rect.height);

  overlay.classList.add("active");
  startStaticAnimation(canvas);
}

function hideStaticOverlay() {
  const overlay = document.getElementById("static-overlay");
  overlay.classList.remove("active");
  stopStaticAnimation();
}

// ── Channel Number OSD ───────────────────────────────────
function showChannelOSD(channelId) {
  const osd = document.getElementById("channel-osd");
  const channel = CHANNELS.find((c) => c.id === channelId);

  const numStr = String(channelId).padStart(2, "0");
  osd.innerHTML = `
    <div class="osd-channel-num">CH ${numStr}</div>
    <div class="osd-channel-name">${channel ? channel.name : ""}</div>
  `;

  osd.classList.add("visible");

  clearTimeout(channelOSDTimeout);
  channelOSDTimeout = setTimeout(() => {
    osd.classList.remove("visible");
  }, 2500);
}

// ── Commercial Bug ("AD" tag) ────────────────────────────
function showCommercialBug() {
  const bug = document.getElementById("commercial-bug");
  bug.classList.add("visible");

  clearTimeout(commercialBugTimeout);
  commercialBugTimeout = setTimeout(() => {
    bug.classList.remove("visible");
  }, 3000);
}

function hideCommercialBug() {
  const bug = document.getElementById("commercial-bug");
  bug.classList.remove("visible");
  clearTimeout(commercialBugTimeout);
}

// ── Channel Switch Sequence ──────────────────────────────
// ── Channel Switch Animation Sequence ────────────────────
async function channelSwitchEffect(newChannelId, loadCallback) {
  if (typeof isPoweredOn !== "undefined" && !isPoweredOn) return;

  // 1. Show static and play static sound
  showStaticOverlay();
  startStaticSound();
  playSound("channel-switch");

  // 2. Mute current audio during transition
  if (typeof player !== "undefined" && player && player.mute) {
    player.mute();
  }

  // 3. Wait for static to feel authentic
  await sleep(600);

  // 4. Show channel number
  showChannelOSD(newChannelId);

  // 5. Trigger the video load (callback from youtube.js)
  if (loadCallback) {
    await loadCallback();
  }

  // The static visual and sound will now only be cleared by the PLAYING state in youtube.js
}

// ── Screen Glitch Effect (random micro-glitches) ─────────
let glitchInterval = null;

function startScreenGlitches() {
  glitchInterval = setInterval(() => {
    const screen = document.getElementById("tv-screen");
    
    // Basic micro-glitches
    if (Math.random() < 0.15) { // 15% chance each tick
      screen.classList.add("glitch");
      setTimeout(() => screen.classList.remove("glitch"), 80 + Math.random() * 120);
    }
    
    // Advanced VHS tracking/color glitches
    if (Math.random() < 0.05) { // 5% chance every 3 seconds
      const isColorGlitch = Math.random() > 0.5;
      const glitchClass = isColorGlitch ? "glitch-color" : "glitch-tracking";
      
      screen.classList.add(glitchClass);
      setTimeout(() => screen.classList.remove(glitchClass), Math.random() * 1500 + 500);
    }
  }, 3000);
}

function stopScreenGlitches() {
  clearInterval(glitchInterval);
  glitchInterval = null;
  const screen = document.getElementById("tv-screen");
  if (screen) {
    screen.classList.remove("glitch", "glitch-color", "glitch-tracking");
  }
}

// ── Utility ──────────────────────────────────────────────
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

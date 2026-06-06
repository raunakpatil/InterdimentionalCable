// ══════════════════════════════════════════════════════════
//  INTERGALACTIC CABLE TV — Main Application Controller
// ══════════════════════════════════════════════════════════
//
//  State machine: splash → powered_on → powered_off
//  Handles all user input: keyboard, touch, remote buttons
// ══════════════════════════════════════════════════════════

let isPoweredOn = false;
let isMuted = false;
let channelNumber = 1;
let appState = "powered_off"; // splash | powered_on | powered_off

// ── Power On ─────────────────────────────────────────────
function powerOn() {
  appState = "powered_on";
  isPoweredOn = true;
  document.body.classList.add("tv-on");

  // Initialize audio context on first user gesture
  if (typeof initAudio === 'function') initAudio();

  const tvContent = document.getElementById("tv-content");
  const powerScreen = document.getElementById("power-off-screen");
  const tvOffBg = document.getElementById("tv-off-bg");
  const roomContainer = document.getElementById("room-container");

  // Remove power-off state
  powerScreen.classList.remove("active");
  const tvScreen = document.getElementById("tv-screen");
  if (tvScreen) tvScreen.classList.remove("powering-off");
  tvContent.classList.remove("powering-off"); // fallback
  if (tvOffBg) tvOffBg.classList.add("hidden");
  if (roomContainer) roomContainer.classList.add("zoomed");

  // Play power-on animation
  tvContent.classList.add("powering-on");
  playSound("tv-on");

  // Show static during boot
  showStaticOverlay();
  startStaticSound();

  setTimeout(() => {
    tvContent.classList.remove("powering-on");
  }, 500);

  // Start screen glitches
  startScreenGlitches();

  // Initialize YouTube player if not done
  if (!playerReady) {
    initYouTubePlayer();
  } else {
    showChannelOSD(channelNumber);
    playNextVideo();
  }
}

// ── Power Off ────────────────────────────────────────────
function powerOff() {
  appState = "powered_off";
  isPoweredOn = false;
  document.body.classList.remove("tv-on");

  playSound("tv-off");
  stopStaticSound();
  stopScreenGlitches();

  const tvScreen = document.getElementById("tv-screen");
  if (tvScreen) {
    tvScreen.classList.remove("powering-off");
    void tvScreen.offsetWidth; // force reflow
    tvScreen.classList.add("powering-off");
  }

  const roomContainer = document.getElementById("room-container");
  if (roomContainer) roomContainer.classList.remove("zoomed");

  // Pause video after animation
  setTimeout(() => {
    if (player && player.pauseVideo) {
      player.pauseVideo();
      player.mute();
    }
    const powerScreen = document.getElementById("power-off-screen");
    powerScreen.classList.add("active");
    
    const tvOffBg = document.getElementById("tv-off-bg");
    if (tvOffBg) tvOffBg.classList.remove("hidden");
  }, 500);
}

// ── Toggle Power ─────────────────────────────────────────
function togglePower() {
  if (isPoweredOn) {
    powerOff();
  } else {
    powerOn();
  }
}

// ── Channel Switching ────────────────────────────────────
function changeChannel(direction) {
  if (!isPoweredOn) return;

  channelNumber =
    ((channelNumber - 1 + direction + CHANNELS.length) % CHANNELS.length) + 1;

  // Clear current queue and load new channel
  videoQueue = [];
  isPlayingCommercial = false;

  channelSwitchEffect(channelNumber, async () => {
    await playNextVideo();
  });
}

function switchToChannel(num) {
  if (!isPoweredOn) return;
  if (num < 1 || num > CHANNELS.length) return;
  if (num === channelNumber) {
    // Same channel — just flash OSD
    showChannelOSD(channelNumber);
    return;
  }

  channelNumber = num;
  videoQueue = [];
  isPlayingCommercial = false;

  channelSwitchEffect(channelNumber, async () => {
    await playNextVideo();
  });
}

// ── Volume ───────────────────────────────────────────────
function adjustVolume(delta) {
  if (!isPoweredOn || !player || !player.getVolume) return;
  const vol = Math.min(100, Math.max(0, player.getVolume() + delta));
  player.setVolume(vol);

  // Show volume OSD briefly
  showVolumeOSD(vol);
}

function showChannelOSD(chNum) {
  const osd = document.getElementById("channel-osd");
  const channel = CHANNELS.find((c) => c.id === chNum);

  const numStr = String(chNum).padStart(2, "0");
  osd.innerHTML = `
    <div class="osd-channel-num">CH ${numStr}</div>
  `;

  osd.classList.add("visible");
  
  clearTimeout(channelOSDTimeout);
  channelOSDTimeout = setTimeout(() => {
    osd.classList.remove("visible");
  }, 1500);
}

function showVolumeOSD(vol) {
  const osd = document.getElementById("channel-osd");
  const bars = Math.round(vol / 10);
  
  let blocks = [];
  // Empty blocks on top
  for (let i = 0; i < 10 - bars; i++) {
    blocks.push("░");
  }
  // Filled blocks on bottom
  for (let i = 0; i < bars; i++) {
    blocks.push("█");
  }

  osd.innerHTML = `
    <div class="osd-channel-num" style="margin-bottom: 4px;">VOL</div>
    <div class="osd-volume-bar" style="line-height: 0.9;">${blocks.join("<br>")}</div>
  `;

  osd.classList.add("visible");
  
  clearTimeout(channelOSDTimeout);
  channelOSDTimeout = setTimeout(() => {
    osd.classList.remove("visible");
  }, 1500);
}

// ── Mute ─────────────────────────────────────────────────
function toggleMute() {
  if (!isPoweredOn || !player) return;
  isMuted = !isMuted;

  if (isMuted) {
    player.mute();
    showMuteOSD(true);
  } else {
    player.unMute();
    showMuteOSD(false);
  }
}

function showMuteOSD(muted) {
  const osd = document.getElementById("channel-osd");
  osd.innerHTML = `
    <div class="osd-channel-num">${muted ? "🔇 MUTED" : "🔊 UNMUTED"}</div>
  `;
  osd.classList.add("visible");

  clearTimeout(channelOSDTimeout);
  channelOSDTimeout = setTimeout(() => {
    osd.classList.remove("visible");
  }, 1500);
}

// ── Remote Interaction Helper ────────────────────────────
function triggerRemoteInteraction() {
  if (typeof playSound === "function") playSound("click");
  const led = document.getElementById("remote-led");
  if (led) {
    led.classList.add("active");
    clearTimeout(led.timeout);
    led.timeout = setTimeout(() => led.classList.remove("active"), 150);
  }
}

// ── Keyboard Input ───────────────────────────────────────
const KEYBINDINGS = {
  ArrowRight: () => changeChannel(1),
  ArrowLeft: () => changeChannel(-1),
  Right: () => changeChannel(1),
  Left: () => changeChannel(-1),
  n: () => changeChannel(1),
  N: () => changeChannel(1),
  j: () => changeChannel(1),
  k: () => changeChannel(-1),
  p: () => togglePower(),
  P: () => togglePower(),
  m: () => toggleMute(),
  M: () => toggleMute(),
  s: () => toggleMute(),
  S: () => toggleMute(),
  ArrowUp: () => adjustVolume(10),
  ArrowDown: () => adjustVolume(-10),
  Up: () => adjustVolume(10),
  Down: () => adjustVolume(-10),
  "+": () => adjustVolume(10),
  "=": () => adjustVolume(10),
  "-": () => adjustVolume(-10),
  1: () => switchToChannel(1),
  2: () => switchToChannel(2),
  3: () => switchToChannel(3),
  4: () => switchToChannel(4),
  5: () => switchToChannel(5),
  6: () => switchToChannel(6),
  7: () => switchToChannel(7),
  8: () => switchToChannel(8),
  9: () => switchToChannel(9),
};

document.addEventListener("keydown", (e) => {
  if (KEYBINDINGS[e.key]) {
    e.preventDefault();
    triggerRemoteInteraction();
    KEYBINDINGS[e.key]();
  }
});

// ── Touch / Swipe Input ──────────────────────────────────
let touchStartX = 0;
let touchStartY = 0;

document.addEventListener("touchstart", (e) => {
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
}, { passive: true });

document.addEventListener("touchend", (e) => {
  const dx = touchStartX - e.changedTouches[0].clientX;
  const dy = touchStartY - e.changedTouches[0].clientY;

  // Horizontal swipe
  if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) {
    changeChannel(dx > 0 ? 1 : -1);
  } 
  // Vertical swipe (mobile only)
  else if (window.innerWidth <= 768 && Math.abs(dy) > 60 && Math.abs(dy) > Math.abs(dx)) {
    changeChannel(dy > 0 ? 1 : -1);
  }
}, { passive: true });

// ── Boot Sequence ────────────────────────────────────────
function typeBootSequence() {
  const bootEl = document.getElementById("boot-text");
  if (!bootEl) return;

  const lines = [
    "Welcome to the Inter-Dimensional TV room",
    "Initializing Multiversal Cable connection..."
  ];

  let currentLine = 0;
  let currentChar = 0;
  let currentText = "";

  function typeChar() {
    if (currentLine >= lines.length) {
      // Done typing. Wait 3 seconds, then fade out
      setTimeout(() => {
        bootEl.style.opacity = "0";
        
        // Mobile-only: Show swipe hint 5 seconds after boot text disappears
        setTimeout(() => {
          if (window.innerWidth <= 768) {
            const hintEl = document.getElementById("mobile-swipe-hint");
            if (hintEl) {
              hintEl.classList.add("visible");
              setTimeout(() => {
                hintEl.classList.remove("visible");
              }, 5000);
            }
          }
        }, 5000);
        
      }, 3000);
      return;
    }

    if (currentChar < lines[currentLine].length) {
      currentText += lines[currentLine][currentChar];
      bootEl.innerHTML = currentText + "<span class='typing-cursor'>_</span>";
      currentChar++;
      // Random typing speed (30ms - 80ms)
      setTimeout(typeChar, Math.random() * 50 + 30); 
    } else {
      currentText += "\n";
      currentLine++;
      currentChar = 0;
      setTimeout(typeChar, 400); // Pause briefly between lines
    }
  }

  // Start sequence 1 second after page load
  setTimeout(typeChar, 1000);
}

// ── Remote Control Buttons ───────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  typeBootSequence();
  initChromaKey();
  initSettingsUI();

  const btn = (id, handler) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("click", () => {
      triggerRemoteInteraction();
      handler();
    });
  };

  btn("btn-power", togglePower);
  btn("btn-ch-up", () => changeChannel(1));
  btn("btn-ch-down", () => changeChannel(-1));
  btn("btn-mute", toggleMute);
  btn("btn-vol-up", () => adjustVolume(10));
  btn("btn-vol-down", () => adjustVolume(-10));

  // Prevent context menu on the TV area
  const tvScreen = document.getElementById("tv-screen");
  if (tvScreen) {
    tvScreen.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  // Mobile: Tap anywhere to toggle remote visibility
  let remoteTimeout;
  document.addEventListener("click", (e) => {
    const remote = document.getElementById("remote-control");
    if (!remote) return;
    
    // Clear any existing timer when the screen is touched
    clearTimeout(remoteTimeout);
    
    // If they clicked inside the remote itself, keep it active and reset the timer
    if (remote.contains(e.target)) {
      remote.classList.add("active");
      remoteTimeout = setTimeout(() => {
        remote.classList.remove("active");
      }, 5000);
      return;
    }
    
    // Tap outside remote: Toggle visibility
    if (remote.classList.contains("active")) {
      remote.classList.remove("active");
    } else {
      remote.classList.add("active");
      // Start 5 second fade-out timer
      remoteTimeout = setTimeout(() => {
        remote.classList.remove("active");
      }, 5000);
    }
  });
});

// ── Chroma Key Overlay ───────────────────────────────────
function initChromaKey() {
  const canvas = document.getElementById('room-overlay-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  
  const isPortrait = window.matchMedia("(max-aspect-ratio: 1/1)").matches;
  const img = new Image();
  img.crossOrigin = "Anonymous";
  img.src = isPortrait ? "assets/room-mobile-green.jpg" : "assets/room-green.jpg";

  img.onload = () => {
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    // Chroma key out the bright green (aggressive to catch JPG fringing)
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      // If green is the dominant color, make it transparent
      if (g > 90 && g > r * 1.2 && g > b * 1.2) {
        data[i + 3] = 0; // Transparent
      }
    }
    ctx.putImageData(imageData, 0, 0);
  };
}

// ── Settings UI ──────────────────────────────────────────
function initSettingsUI() {
  const modal = document.getElementById("settings-modal");
  const btnSettings = document.getElementById("btn-settings");
  const btnClose = document.getElementById("btn-close-settings");
  const btnSave = document.getElementById("btn-save-settings");
  const inputsContainer = document.getElementById("channel-inputs");
  
  if (!modal || !btnSettings) return;

  // Load saved settings
  const savedSettings = JSON.parse(localStorage.getItem("custom_channels")) || {};

  // Build inputs
  let html = "";
  CHANNELS.forEach(ch => {
    const val = savedSettings[ch.id] || "";
    html += `
      <div class="channel-input-row">
        <label>CH ${ch.id}</label>
        <input type="text" id="setting-ch-${ch.id}" placeholder="Default (${ch.name})" value="${val}">
      </div>
    `;
  });
  inputsContainer.innerHTML = html;

  btnSettings.addEventListener("click", () => {
    modal.classList.add("active");
  });

  btnClose.addEventListener("click", () => {
    modal.classList.remove("active");
  });

  btnSave.addEventListener("click", () => {
    const newSettings = {};
    CHANNELS.forEach(ch => {
      const val = document.getElementById(`setting-ch-${ch.id}`).value.trim();
      if (val) {
        newSettings[ch.id] = val;
      }
    });
    localStorage.setItem("custom_channels", JSON.stringify(newSettings));
    
    // Clear queue caches so new settings take effect
    CHANNELS.forEach(ch => localStorage.removeItem("queue_" + ch.id));
    
    // Reboot TV
    modal.classList.remove("active");
    if (isPoweredOn) powerOff();
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  });
}

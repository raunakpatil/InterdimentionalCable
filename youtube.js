// ══════════════════════════════════════════════════════════
//  INTERGALACTIC CABLE TV — YouTube Player Engine
// ══════════════════════════════════════════════════════════
//
//  Wraps the YouTube IFrame Player API to behave like a
//  broadcast TV: no pause, no scrub, no rewind.
//
//  Two modes:
//    - API mode:     Uses YouTube Data API v3 to search for
//                    videos by channel topic (requires key)
//    - Fallback mode: Uses hardcoded video IDs from channels.js
//                    (no API key needed)
// ══════════════════════════════════════════════════════════

let player = null;
let currentVideo = null;
let currentChannel = 1;
let videoQueue = [];
let isPlayingCommercial = false;
let playerReady = false;
let lastCommercialIndex = -1;
let playbackMonitor = null;
let stuckTimer = null;

// ── Initialize YouTube IFrame API ────────────────────────
function initYouTubePlayer() {
  const tag = document.createElement("script");
  tag.src = "https://www.youtube.com/iframe_api";
  document.head.appendChild(tag);
}

// Called by YouTube API when script loads
window.onYouTubeIframeAPIReady = function () {
  player = new YT.Player("yt-player", {
    width: "100%",
    height: "100%",
    playerVars: {
      autoplay: 1,
      mute: 1, // Crucial: forces browser to allow autoplay, we unmute right after it starts
      controls: 0,
      disablekb: 1,
      fs: 0,
      iv_load_policy: 3,
      modestbranding: 1,
      rel: 0,
      showinfo: 0,
      playsinline: 1,
      enablejsapi: 1,
      origin: window.location.origin,
    },
    events: {
      onReady: onPlayerReady,
      onStateChange: onPlayerStateChange,
      onError: onPlayerError,
    },
  });

  // Tap to play handler
  const tapOverlay = document.getElementById("tap-to-play-overlay");
  if (tapOverlay) {
    tapOverlay.addEventListener("click", () => {
      if (player && typeof player.playVideo === "function") {
        player.unMute();
        player.playVideo();
        tapOverlay.classList.add("hidden");
      }
    });
  }
};

function onPlayerReady() {
  playerReady = true;
  player.setVolume(80);
  showStaticOverlay();
  startStaticSound();
  playNextVideo();

  // Failsafe: if the user clicks the TV, force play
  const blocker = document.getElementById("player-blocker");
  if (blocker) {
    blocker.addEventListener("click", () => {
      if (player && typeof player.playVideo === "function") {
        player.playVideo();
      }
    });
  }
}

function onPlayerStateChange(event) {
  // If TV is off, immediately stop playback and ignore state changes
  if (typeof isPoweredOn !== "undefined" && !isPoweredOn) {
    if (player && typeof player.stopVideo === "function") {
      player.stopVideo();
    }
    return;
  }

  if (playbackMonitor) {
    clearInterval(playbackMonitor);
    playbackMonitor = null;
  }

  if (event.data === YT.PlayerState.ENDED) {
    isPlayingCommercial = false;
    hideCommercialBug();
    playNextVideo();
  }

  if (event.data === YT.PlayerState.CUED) {
    if (isCueingFallbackPlaylist) {
      isCueingFallbackPlaylist = false;
      const playlistVideos = player.getPlaylist();
      if (playlistVideos && playlistVideos.length > 0) {
        const played = getPlayedVideos();
        const unplayed = playlistVideos.filter(id => !played.includes(id));
        let randomVid;
        if (unplayed.length > 0) {
           randomVid = unplayed[Math.floor(Math.random() * unplayed.length)];
        } else {
           randomVid = playlistVideos[Math.floor(Math.random() * playlistVideos.length)];
        }
        markVideoPlayed(randomVid);
        isCueingFallbackVideo = true;
        player.cueVideoById({ videoId: randomVid });
      } else {
        // Failed to load playlist videos, try again
        playFallbackVaultItem();
      }
      return;
    } else if (isCueingFallbackVideo) {
      isCueingFallbackVideo = false;
      const duration = player.getDuration() || 0;
      let startSec = 0;
      if (duration >= 180) {
         // >= 3 minutes: play from the 25% point
         startSec = Math.floor(duration * 0.25);
      } else if (duration > 30) {
         // < 3 minutes: play from the 10% point
         startSec = Math.floor(duration * 0.10);
      }
      player.seekTo(startSec, true);
      player.playVideo();
      return;
    }
  }

  if (event.data === YT.PlayerState.UNSTARTED || event.data === YT.PlayerState.CUED) {
    // Browser might have blocked autoplay, try to force it
    setTimeout(() => {
      if (player && typeof player.playVideo === "function") {
        player.playVideo();
      }
    }, 500);

    // If still stuck after 2.5s (likely strict mobile browser), show TAP TO PLAY overlay
    clearTimeout(stuckTimer);
    stuckTimer = setTimeout(() => {
      if (player && player.getPlayerState() !== YT.PlayerState.PLAYING) {
        const tapOverlay = document.getElementById("tap-to-play-overlay");
        if (tapOverlay) tapOverlay.classList.remove("hidden");
      }
    }, 2500);
  }

  if (event.data === YT.PlayerState.PLAYING) {
    clearTimeout(stuckTimer);
    const tapOverlay = document.getElementById("tap-to-play-overlay");
    if (tapOverlay) tapOverlay.classList.add("hidden");
    // Start monitoring playback to cut the video right before the end
    playbackMonitor = setInterval(() => {
      if (player && typeof player.getDuration === "function" && typeof player.getCurrentTime === "function") {
        const duration = player.getDuration();
        const currentTime = player.getCurrentTime();
        // Cut it off 1.5 seconds before it fully ends to prevent YouTube's suggestion grid
        if (duration > 0 && (duration - currentTime) <= 1.5) {
          clearInterval(playbackMonitor);
          playbackMonitor = null;
          isPlayingCommercial = false;
          hideCommercialBug();
          playNextVideo();
        }
      }
    }, 500);

    // Video started, wait 4 seconds before clearing static and unmuting to hide YT UI
    setTimeout(() => {
      if (typeof isPoweredOn !== "undefined" && !isPoweredOn) return; // Abort if TV is turned off during the wait
      hideStaticOverlay();
      stopStaticSound();
      if (!isMuted) {
        player.unMute();
      }
      
      // Trigger VHS lock-in distortion effect to make the video snap into place
      const tvScreen = document.getElementById("tv-screen");
      if (tvScreen) {
        tvScreen.classList.remove("vhs-lock");
        // trigger reflow
        void tvScreen.offsetWidth;
        tvScreen.classList.add("vhs-lock");
      }
    }, 4000);
  }

  if (event.data === YT.PlayerState.BUFFERING) {
    // Optionally show subtle loading state
  }
}

function onPlayerError(event) {
  // Video can't be embedded or is unavailable — skip
  console.warn("Video error (code " + event.data + "), skipping...");
  isCueingFallbackPlaylist = false;
  isCueingFallbackVideo = false;
  setTimeout(() => {
    if (isPlayingCommercial) {
      isPlayingCommercial = false;
      playNextVideo();
    } else {
      playNextVideo();
    }
  }, 300);
}


const FALLBACK_VAULT = [
  "PLx8zUw4PoWHgqy5bD0HcuuTgVqPOSNrHn",
  "PLLLojrb9yxrpsROvUuH4bs3FBYeC1Y7Zo",
  "PL1zuqabrVlPu09hsd9ANXCJCwIjone1mM",
  "PLd4hww6QWFS4uV1WLQnisBKnw2BzV8vax",
  "PLCDmcCIhrlrtA5wlsqAVCMkiP8rRUmTb6",
  "PLXKAG8g1Ls_Ax-SU7rCgyiGWjylB5NHL-",
  "PLYSmQ0A-61NNWwuLj_C3c7Lm-SkGXbVtz",
  "PLv3TTBr1W_9tppikBxAE_G6qjWdBljBHJ",
  "PL3kMog0muMAf635gv2-y08yxDrmbns01M",
  "PLWbjr9R6q0CZRHjhyHZF0WrePmsq6lmPH",
  "PL998D45ACD1FA676B",
  "PLycor1XF7S9HVMnWxndl27HgZJM5S8wRT",
  "PLS_gQd8UB-hLxA3kwIWFwEmy2s66Xarig",
  "PLZNOciu3LFNqQY0YCMA_NohqrzMZv-cpO",
  "PLiyIsd32rycMRyAMv_QSbTDWn_H5jZsOX",
  "PLYhREcq3PbZ8duNVstBQ_0jnHC1ffxJfu",
  "PL526CAC8386C3D352",
  "PLx0vtrDvEFgguHJ5G9NQ6AF9n_QccP7Xz",
  "PL96675BDF95286773",
  "PL7VbZkDD1Y3GB6C4r_-J5h3VvZyqRnpnl",
  "PL66vjJ3dQ0GN_dx6A2tO7DnUQqab2-GWN",
  "PLv0IrZ_k9MsK1RX0NqZbYXPdujvRjHkIr",
  "PLLb4Aujw26R6FsJJ3py4ponBlBxp0UnRA",
  "PL88D33D34A498DFE2",
  "PLg6R6yXKSLYBmWGGP6Y3NySXRnwStR4k5",
  "PLYlNSZHj9N2XAa0ZSU_dxrnFqYWlhPiC_",
  "PLo7WLtfSrhdbdR4K_EQzplNiDYZMFk8jQ",
  "PLJGccvC-yhA269oq16Dh3q0uAUYgdJug8",
  "PLnxaxk1JJXBDmtblIj8eEGFSfVSPpwK7A",
  "PLKiCeH88kFs81KTkAG8OXoTUnJ66HVwxv",
  "PLw8Akp5tqURiGuzraIUoMLi05A1U8XG6M",
  "PLfI-qauExviAxeLg8fJFnzspHRU__fuj0",
  "PLnuf8iyXggLEvh3xEzsDuvqG9OHIOJnRV",
  "PLlUZ3i-FUgHqk9-C-Fw_C6YsvTyx2c8nc",
  "PLyAs-leLcXRoSWEn79q-agotWIoX3Z4vH",
  "PL2Z1u_tM759p-cfmU6rQ7c3dutVQ-m6Vt",
  "PLoaTLsTsV3hNkTxJfircjW3etUDZIYMXX",
  "PLOhlY65vnTp7730NAYQhhk5vFintMHLNr",
  "PLBPu7MzosNgelY0_jSmSGchraZOryJiWR",
  "PL4c_v9yehYQ7IJgH8IGlMJ6m06kLB7OrR",
  "PLSmgKijb47W--b6j4Mro3mekDU7MUU2yi",
  "PLDoWn-XzaQXsWV2yBZ2oDEhpzMaMFczqq",
  "PLEQNv0J-3Gt4kP-HIdH_MvJFcPtKXg9M0",
  "PL2FeM9uR75cPA-TgxErGB3aWNIB71wg_G",
  "PLz58QJ68R9CTLHNi4N2FnvHyK-7V2lGbG",
  "PL1_uQL4mC3x43QfTui5KsRxVY5mr4IdlD",
  "PLQN71JwsB-QdGIwSjetCKSizlI33MTraG",
  "PL-NHxGqGGGk96lkKvjvpBKGfIdKE2Izwk",
  "PL-quEdx8WqHlprhjobu4ibR3M5QmO9zPd",
  "PLycMmd-qm8f8G5EP4CL96XrtDiqdqajPf",
  "PLSZN96b3ahbUbS9cDWoMmPs-0m6yKa1qX",
  "PLQd_wZtqof8t7ygAgUbEaPM5j3oNEEfOW",
  "PLR_f29j3vPnyrqebbX1s-U0G6nwjZv5rP",
  "PLo2sxVnbrTqBjQw_mCEV9o3D2rftPiuz5",
  "PL532nVurngGsbmyc2bf7n8tT34AFfKLjs",
  "PLAamU2iv-fSshxuJnUdDs9e31qJgr7uSO",
  "PL2HFHSMDNvlbMCBZU4Qu0ZiaCm-RyYZls",
  "PLR2oBasP_pG8BZRk5K-0qZA_RZh-HKbdF",
  "PL20x6bmPMsWIgHc4h6Y7SpOVRNEAoNW4X"
];

let vaultBag = [];

function getFallbackVaultItem() {
  if (vaultBag.length === 0) {
    vaultBag = [...FALLBACK_VAULT].sort(() => Math.random() - 0.5);
  }
  return vaultBag.pop();
}

function playFallbackVaultItem() {
  hasShownApiError = true;
  videoQueue = []; // Clear queue so we don't mix modes
  const vaultItem = getFallbackVaultItem();

  // Explicitly mute player before cueing so mobile browsers allow async playVideo()
  if (player && player.mute) player.mute();

  if (vaultItem.startsWith("PL")) {
    isCueingFallbackPlaylist = true;
    player.cuePlaylist({ listType: "playlist", list: vaultItem });
  } else {
    // Single video fallback
    markVideoPlayed(vaultItem);
    isCueingFallbackVideo = true;
    player.cueVideoById({ videoId: vaultItem });
  }
}



// ── Watch History Tracking ───────────────────────────────
function getPlayedVideos() {
  return JSON.parse(localStorage.getItem("played_videos") || "[]");
}

function markVideoPlayed(id) {
  const played = getPlayedVideos();
  if (!played.includes(id)) {
    played.push(id);
    if (played.length > 500) played.shift(); // Keep last 500
    localStorage.setItem("played_videos", JSON.stringify(played));
  }
}

// ── Play Next Video ──────────────────────────────────────
async function playNextVideo() {
  if (!playerReady || !player) return;

  // Mask video transitions and loading times with static
  showStaticOverlay();
  startStaticSound();

  // Pure vault mode (API dependency removed)
  playFallbackVaultItem();
}

// ── Commercial System ────────────────────────────────────
function playCommercial() {
  if (!COMMERCIALS || COMMERCIALS.length === 0) {
    playNextVideo();
    return;
  }

  // Don't repeat last commercial
  let idx;
  do {
    idx = Math.floor(Math.random() * COMMERCIALS.length);
  } while (idx === lastCommercialIndex && COMMERCIALS.length > 1);

  lastCommercialIndex = idx;
  isPlayingCommercial = true;

  // Show "AD" bug
  showCommercialBug();

  // Brief static transition
  showStaticOverlay();
  playSound("channel-switch");

  setTimeout(() => {
    player.loadVideoById({
      videoId: COMMERCIALS[idx].id,
      startSeconds: 0, // Commercials always start from beginning
    });
  }, 400);
}

// ── Duration Parsing ─────────────────────────────────────
function parseISO8601Duration(duration) {
  // "PT4M33S" → 273 seconds
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  return (
    ((+match[1] || 0) * 3600) +
    ((+match[2] || 0) * 60) +
    (+match[3] || 0)
  );
}

function calculateHookStart(durationSeconds) {
  // Start between 3% and 30% into the video
  const min = Math.floor(durationSeconds * 0.03);
  const max = Math.floor(durationSeconds * 0.30);
  return Math.floor(Math.random() * (max - min)) + min;
}

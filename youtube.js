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
let isCueingFallbackPlaylist = false;
let isCueingFallbackVideo = false;
let hasShownApiError = false;
let captionsEnabled = false;
let pendingPlayerResume = null;
let isRebuildingPlayer = false;

// Shared embed options. `mute: 1` is crucial: it lets the browser start
// playback without a gesture; the app unmutes once the picture is running.
const PLAYER_VARS = {
  autoplay: 1,
  mute: 1,
  controls: 0,
  disablekb: 1,
  fs: 0,
  iv_load_policy: 3,
  modestbranding: 1,
  rel: 0,
  showinfo: 0,
  cc_load_policy: 0,
  playsinline: 1,
  enablejsapi: 1,
};

// ── Initialize YouTube IFrame API ────────────────────────
function initYouTubePlayer() {
  const tag = document.createElement("script");
  tag.src = "https://www.youtube.com/iframe_api";
  document.head.appendChild(tag);
}

function buildPlayer(target, extraVars, videoId) {
  const playerVars = Object.assign({}, PLAYER_VARS, extraVars, {
    origin: window.location.origin,
  });
  const config = {
    width: "100%",
    height: "100%",
    playerVars,
    events: {
      onReady: onPlayerReady,
      onStateChange: onPlayerStateChange,
      onApiChange: onPlayerApiChange,
      onError: onPlayerError,
    },
  };
  if (videoId) config.videoId = videoId;
  return new YT.Player(target, config);
}

// Called by YouTube API when script loads
window.onYouTubeIframeAPIReady = function () {
  player = buildPlayer("yt-player");
};

function onPlayerReady(event) {
  player = (event && event.target) || player;
  playerReady = true;
  player.setVolume(80);

  // Captions start off on every load, even if the browser remembered them.
  captionsEnabled = false;
  setCaptionButtonState(false);
  try {
    player.setOption("captions", "track", {});
  } catch (error) {
    // The captions module is not loaded until the viewer asks for it.
  }

  // The user may have powered the set off while the API was loading.
  if (typeof isPoweredOn !== "undefined" && !isPoweredOn) {
    pendingPlayerResume = null;
    isRebuildingPlayer = false;
    return;
  }

  // The player was rebuilt to clear a stale caption cue. Resume the same
  // broadcast at the same position instead of picking a new video.
  if (pendingPlayerResume) {
    const resume = pendingPlayerResume;
    pendingPlayerResume = null;
    player.setVolume(resume.volume);
    if (resume.startTime > 0.5) {
      try {
        player.seekTo(resume.startTime, true);
      } catch (error) {
        // The constructor's `start` value already covers the position.
      }
    }
    player.playVideo();
    return;
  }

  showStaticOverlay();
  startStaticSound();
  playNextVideo();

  // Failsafe: if the user clicks the TV, force play
  const blocker = document.getElementById("player-blocker");
  if (blocker && !blocker.dataset.playBound) {
    blocker.dataset.playBound = "1";
    blocker.addEventListener("click", () => {
      if (player && typeof player.playVideo === "function") {
        player.playVideo();
      }
    });
  }
}

function rebuildPlayerForCaptions() {
  if (!player || !playerReady || typeof player.destroy !== "function") return;
  if (typeof isPoweredOn !== "undefined" && !isPoweredOn) return;
  if (typeof player.getVideoData !== "function") return;

  const video = player.getVideoData();
  if (!video || !video.video_id) return;

  const resume = {
    videoId: video.video_id,
    startTime: Math.max(0, player.getCurrentTime() || 0),
    volume: typeof player.getVolume === "function" ? player.getVolume() : 80,
    muted: typeof player.isMuted === "function" ? player.isMuted() : false,
  };

  pendingPlayerResume = resume;
  isRebuildingPlayer = true;
  playerReady = false;

  try {
    player.destroy();
  } catch (error) {
    console.warn("Could not rebuild the player:", error);
    pendingPlayerResume = null;
    isRebuildingPlayer = false;
    playerReady = true;
    return;
  }

  // `destroy()` removes the iframe. Give the new player a fresh host inside
  // the same TV content so all existing layout rules still apply.
  const host = document.createElement("div");
  host.id = "yt-player";
  const parent = document.getElementById("tv-content");
  (parent || document.body).appendChild(host);

  player = buildPlayer(host, {
    start: Math.floor(resume.startTime),
  }, resume.videoId);
}

// ── Captions ─────────────────────────────────────────────
function availableCaptionTracks() {
  if (!player || typeof player.getOption !== "function") return [];
  try {
    return player.getOption("captions", "tracklist") || [];
  } catch (error) {
    return [];
  }
}

function preferredCaptionTrack(tracks) {
  const language = (track) => (track.languageCode || "").toLowerCase();
  return (
    tracks.find((track) => language(track).startsWith("en")) ||
    tracks.find((track) => track.is_default) ||
    tracks[0] ||
    null
  );
}

function applyCaptionTrack() {
  if (!captionsEnabled || !player) return;
  // Some auto-generated tracks are not listed in `tracklist` but can still
  // be selected by language, so fall back to English rather than giving up.
  const track =
    preferredCaptionTrack(availableCaptionTracks()) || { languageCode: "en" };
  try {
    player.setOption("captions", "track", track);
  } catch (error) {
    console.warn("Could not enable captions:", error);
  }
}

function syncCaptions() {
  if (!captionsEnabled || !player) return;
  if (typeof player.loadModule === "function") {
    player.loadModule("captions");
  }
  applyCaptionTrack();
}

function toggleCaptions() {
  if (!isPoweredOn || !player || !playerReady || isRebuildingPlayer) return;
  const wasEnabled = captionsEnabled;
  captionsEnabled = !captionsEnabled;
  setCaptionButtonState(captionsEnabled);

  if (captionsEnabled) {
    syncCaptions();
    showCaptionsOSD(true);
  } else {
    try {
      player.setOption("captions", "track", {});
    } catch (error) {
      console.warn("Could not disable captions:", error);
    }
    showCaptionsOSD(false);

    // YouTube's captions module leaves the last cue frozen on screen when
    // captions are switched off through the API. Rebuild the player around
    // the same video to guarantee a clean off.
    if (wasEnabled) {
      showStaticOverlay();
      startStaticSound();
      rebuildPlayerForCaptions();
    }
  }
}

function onPlayerApiChange() {
  if (captionsEnabled) applyCaptionTrack();
}

// ── Stuck-load watchdog ──────────────────────────────────
// A cue can fail silently or a stream can stall in BUFFERING forever,
// leaving the set on static. If no picture arrives in time, change channel.
const LOAD_TIMEOUT_MS = 9000;

function armStuckTimer() {
  clearTimeout(stuckTimer);
  stuckTimer = setTimeout(() => {
    stuckTimer = null;
    if (typeof isPoweredOn !== "undefined" && !isPoweredOn) return;
    console.warn("Video took too long to start, skipping...");
    isCueingFallbackPlaylist = false;
    isCueingFallbackVideo = false;
    isPlayingCommercial = false;
    playNextVideo();
  }, LOAD_TIMEOUT_MS);
}

function clearStuckTimer() {
  clearTimeout(stuckTimer);
  stuckTimer = null;
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

  if (event.data === YT.PlayerState.PAUSED) {
    // Broadcast TV cannot be paused. This also clears YouTube's large
    // play/pause overlay if a stray click or focus change paused the video.
    setTimeout(() => {
      if (player && isPoweredOn && typeof player.playVideo === "function") {
        player.playVideo();
      }
    }, 250);
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
  }

  if (event.data === YT.PlayerState.BUFFERING && !stuckTimer) {
    armStuckTimer();
  }

  if (event.data === YT.PlayerState.PLAYING) {
    clearStuckTimer();
    // Re-apply the caption preference when a new video starts.
    if (captionsEnabled) {
      applyCaptionTrack();
      setTimeout(applyCaptionTrack, 600);
    }

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

    if (isRebuildingPlayer) {
      // CC-off rebuild: keep the static mask brief so the picture returns
      // immediately, then restore audio.
      isRebuildingPlayer = false;
      setTimeout(() => {
        if (typeof isPoweredOn !== "undefined" && !isPoweredOn) return;
        hideStaticOverlay();
        stopStaticSound();
        if (!isMuted && player && typeof player.unMute === "function") {
          player.unMute();
        }
      }, 350);
    } else {
      // Video started; hold the static briefly to hide the YT title UI
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
      }, 1500);
    }
  }

}

function onPlayerError(event) {
  // Video can't be embedded or is unavailable — skip
  clearStuckTimer();
  console.warn("Video error (code " + event.data + "), skipping...");
  isCueingFallbackPlaylist = false;
  isCueingFallbackVideo = false;
  pendingPlayerResume = null;
  isRebuildingPlayer = false;
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
  "PL20x6bmPMsWIgHc4h6Y7SpOVRNEAoNW4X",
  "VKF4DUhmdFQ",
  "PLeCPQtbuJaPtLugP7UijMU-ozdNmkdNFO",
  "PL7143AF12E03570E2",
  "PLXLT0cAAZyduzk5U5a43xdgrZY6fBCjMN",
  "PLMRKdK25AuPVjHl9Kdb-gkBy0Cm7Zi2xo",
  "PLEban9uxoM9FsT4Bk6NBX2A5vJDftpTaP",
  "PLrMX9ct-uNyOKfDG0WrRd6fQsB21MzorZ",
  "PLS_gQd8UB-hJQ2jwIM8jO5GZhNGW2y3R7",
  "PL_cExqxU9ahxDw6KWUC0fSPO4UTJrAjV5",
  "PL1Vjcsuog4C5XmPDaj5iWn1Adytfd-goP",
  "PL8HuhQ6MvmEpW2OlcgY3erGGqfvmHkrLM"
];

const channelBags = {};

function getFallbackVaultItem(chNum) {
  const currentCh = typeof channelNumber !== "undefined" ? channelNumber : (chNum || 1);
  const chData = (typeof CHANNELS !== "undefined" && CHANNELS[currentCh - 1]) ? CHANNELS[currentCh - 1] : null;
  const list = (chData && chData.playlists && chData.playlists.length > 0) ? chData.playlists : FALLBACK_VAULT;
  const bagKey = chData ? chData.id : "global";

  if (!channelBags[bagKey] || channelBags[bagKey].length === 0) {
    const copy = [...list];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    channelBags[bagKey] = copy;
  }
  return channelBags[bagKey].pop() || FALLBACK_VAULT[Math.floor(Math.random() * FALLBACK_VAULT.length)];
}

function playFallbackVaultItem() {
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

// ── Broadcast End Handler & Commercial Breaks ────────────
function handleVideoEnded() {
  if (playbackMonitor) {
    clearInterval(playbackMonitor);
    playbackMonitor = null;
  }

  // If a commercial just finished, return to normal channel content
  if (isPlayingCommercial) {
    isPlayingCommercial = false;
    if (typeof hideCommercialBug === "function") hideCommercialBug();
    playNextVideo();
    return;
  }

  videosSinceCommercial++;
  // Every 3-4 videos, take a quick nostalgic commercial break (~45% chance after at least 3 videos)
  if (videosSinceCommercial >= 3 && Math.random() < 0.45 && typeof COMMERCIALS !== "undefined" && COMMERCIALS.length > 0) {
    videosSinceCommercial = 0;
    playCommercial();
  } else {
    isPlayingCommercial = false;
    if (typeof hideCommercialBug === "function") hideCommercialBug();
    playNextVideo();
  }
}

// ── Play Next Video ──────────────────────────────────────
async function playNextVideo() {
  if (!playerReady || !player) return;
  if (typeof isPoweredOn !== "undefined" && !isPoweredOn) return;

  switchSessionId++;
  cueingSessionId = switchSessionId;

  // Mask video transitions and loading times with static
  showStaticOverlay();
  startStaticSound();

  armStuckTimer();
  playFallbackVaultItem();
}

// ── Commercial System ────────────────────────────────────
function playCommercial() {
  if (typeof isPoweredOn !== "undefined" && !isPoweredOn) return;
  if (!COMMERCIALS || COMMERCIALS.length === 0) {
    playNextVideo();
    return;
  }

  let idx;
  do {
    idx = Math.floor(Math.random() * COMMERCIALS.length);
  } while (idx === lastCommercialIndex && COMMERCIALS.length > 1);

  lastCommercialIndex = idx;
  isPlayingCommercial = true;

  switchSessionId++;
  cueingSessionId = switchSessionId;

  // Show "AD" bug
  if (typeof showCommercialBug === "function") showCommercialBug();

  // Brief static transition
  showStaticOverlay();
  startStaticSound();
  if (typeof playSound === "function") playSound("channel-switch");

  armStuckTimer();
  setTimeout(() => {
    if (typeof isPoweredOn !== "undefined" && !isPoweredOn) return;
    if (player && typeof player.loadVideoById === "function") {
      player.loadVideoById({
        videoId: COMMERCIALS[idx].id,
        startSeconds: 0, // Commercials always start from beginning
      });
    }
  }, 400);
}

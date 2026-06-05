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
      if (duration > 30) {
         // Start between 10% and 80% into the video
         startSec = Math.floor(duration * 0.1 + Math.random() * (duration * 0.7));
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

  if (event.data === YT.PlayerState.PLAYING) {
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

// ── Video Queue Management ───────────────────────────────

let hasShownApiError = false;
let isCueingFallbackPlaylist = false;
let isCueingFallbackVideo = false;

async function fetchVideoQueue(channel) {
  // Check if API key is set
  if (typeof YT_API_KEY === "undefined" || !YT_API_KEY || YT_API_KEY.length < 5) {
    if (!hasShownApiError) {
      console.warn("NO YOUTUBE API KEY FOUND! Using fallback vault.");
      hasShownApiError = true;
    }
    return [];
  }

  try {
    const results = await fetchFromAPI(channel);
    if (!results || results.length === 0) {
      hasShownApiError = true;
      return [];
    }
    return results;
  } catch (err) {
    console.error("API fetch failed:", err);
    if (!hasShownApiError && err.message.includes("429")) {
      console.warn("YouTube API Quota Exceeded (429). Falling back to hardcoded playlists.");
    }
    hasShownApiError = true;
    return [];
  }
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
  "PL3kMog0muMAf635gv2-y08yxDrmbns01M"
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

// ── API Mode: YouTube Data API v3 ────────────────────────
async function fetchFromAPI(channel) {
  // Check localStorage cache FIRST to save API quota
  const cacheKey = "queue_" + channel.id;
  const cached = JSON.parse(localStorage.getItem(cacheKey));
  if (cached && cached.expiry > Date.now() && cached.videos && cached.videos.length > 0) {
    return cached.videos;
  }

  // Check for custom override in Settings
  const savedSettings = JSON.parse(localStorage.getItem("custom_channels")) || {};
  const customQuery = savedSettings[channel.id];

  // Pick random search topic (or use custom)
  let topic = "";
  if (customQuery) {
    topic = customQuery;
  } else {
    topic = channel.topics[Math.floor(Math.random() * channel.topics.length)];
    
    // 70% chance to make the query extremely weird, trippy, or hilarious
    if (Math.random() > 0.3) {
      const weirdModifiers = [
        "trippy", "surreal", "bizarre", "psychedelic", "fever dream", "weird", "liminal",
        "funny when high", "shitpost", "cursed video", "absurdist comedy", "late night adult swim", "brainrot",
        "funny ai slop", "animated videos for adult", "animated horror videos",
        "random nonsense", "chaotic random", "weirdcore", "dreamcore", "schizophrenic edit", "surreal meme"
      ];
      const mod = weirdModifiers[Math.floor(Math.random() * weirdModifiers.length)];
      topic = topic + " " + mod;
    }
  }

  // Globally exclude tutorials, news, and podcasts
  const negativeKeywords = ' -tutorial -news -"how to" -"breaking news" -"news channel" -podcast';
  const finalQuery = topic + negativeKeywords;

  const searchUrl =
    "https://www.googleapis.com/youtube/v3/search?" +
    "part=id&type=video" +
    "&q=" + encodeURIComponent(finalQuery) +
    "&videoEmbeddable=true" +
    "&maxResults=15" +
    "&order=relevance" +
    "&videoDuration=medium" +
    "&key=" + YT_API_KEY;

  const searchRes = await fetch(searchUrl);
  if (!searchRes.ok) throw new Error("Search API error: " + searchRes.status);
  const searchData = await searchRes.json();

  if (!searchData.items || searchData.items.length === 0) {
    throw new Error("No search results");
  }

  const videoIds = searchData.items.map((i) => i.id.videoId).join(",");

  // Get durations (only 1 API unit for all!)
  const detailUrl =
    "https://www.googleapis.com/youtube/v3/videos?" +
    "part=contentDetails,snippet" +
    "&id=" + videoIds +
    "&key=" + YT_API_KEY;

  const detailRes = await fetch(detailUrl);
  if (!detailRes.ok) throw new Error("Videos API error: " + detailRes.status);
  const detailData = await detailRes.json();

  const videos = detailData.items
    .map((v) => ({
      id: v.id,
      title: v.snippet.title,
      duration: parseISO8601Duration(v.contentDetails.duration),
      hookStart: 0, // calculated below
    }))
    .filter((v) => v.duration > 60); // Skip shorts

  // Calculate hook start points
  videos.forEach((v) => {
    v.hookStart = calculateHookStart(v.duration);
  });

  // Cache for 60 minutes to aggressively protect API quota
  localStorage.setItem(
    cacheKey,
    JSON.stringify({
      videos: videos,
      expiry: Date.now() + 60 * 60 * 1000,
    })
  );

  return videos;
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

  let validVideoFound = false;
  let fetchAttempts = 0;
  const playedHistory = getPlayedVideos();

  while (!validVideoFound && fetchAttempts < 3) {
    if (hasShownApiError) {
      break; // Abort API search loop if in fallback mode
    }

    if (videoQueue.length === 0) {
      const channel = CHANNELS.find((c) => c.id === currentChannel);
      if (!channel) return;

      const fetched = await fetchVideoQueue(channel);
      
      if (hasShownApiError) {
        break; // fetch failed inside the loop
      }

      // Filter out previously played videos
      const unplayed = fetched.filter((v) => !playedHistory.includes(v.id));
      
      // Shuffle
      videoQueue = unplayed.sort(() => Math.random() - 0.5);
      fetchAttempts++;

      if (videoQueue.length === 0 && fetched.length > 0) {
        // We fetched videos, but ALL of them were already played.
        // Invalidate cache for this channel so next fetch hits the API for fresh results.
        localStorage.removeItem("queue_" + currentChannel);
        continue;
      }
    }

    if (videoQueue.length === 0) {
      console.warn("No valid videos found for channel", currentChannel);
      break;
    }

    currentVideo = videoQueue.pop();
    if (currentVideo) {
      validVideoFound = true;
    }
  }

  // Fallback: If we genuinely ran out of unplayed videos, or API is dead
  if (!currentVideo || hasShownApiError) {
    playFallbackVaultItem();
    return;
  }

  markVideoPlayed(currentVideo.id);

  player.loadVideoById({
    videoId: currentVideo.id,
    startSeconds: currentVideo.hookStart,
  });
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

# 📺 Intergalactic Cable TV

**[▶️ Press here to dive into the Multiverse](https://raunakpatil.github.io/InterdimentionalCable/)**

A free, browser-based broadcast TV simulator inspired by Rick & Morty's interdimensional cable. Flip through bizarre channels of late-night cable from another dimension — no pause, no rewind, just pure chaos.

## 🚀 Quick Start

1. Open `index.html` in a browser (or use a local server)
2. Click **"TURN ON"** to start
3. Use arrow keys to change channels

That's it — no build step, no npm, no frameworks.

## 🎮 Controls

| Key | Action |
|-----|--------|
| `←` `→` | Change channel |
| `1`–`8` | Jump to channel |
| `↑` `↓` | Volume up/down |
| `M` or `S` | Toggle mute |
| `P` | Power on/off |
| Swipe L/R | Change channel (mobile) |

## 📡 Channels

| CH | Name | What You'll See |
|----|------|-----------------|
| 1 | THE VOID | Surreal, experimental, glitch art |
| 2 | FOOD DIMENSION | Bizarre street food, molecular gastronomy |
| 3 | RETRO WAVE | 80s music, synthwave, VHS aesthetic |
| 4 | NATURE CHAOS | Extreme weather, deep ocean, volcanoes |
| 5 | HUMAN FOLLY | Fails, stunts, world record attempts |
| 6 | SCIENCE ZONE | Physics experiments, space footage |
| 7 | INFOMERCIAL | Vintage/weird infomercials |
| 8 | STATIC | White noise, test patterns, glitch loops |

## 🔑 YouTube API Key (Optional)

The app works out of the box with curated fallback videos. To enable live YouTube search:

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project
3. Enable **YouTube Data API v3**
4. Create an API key under Credentials
5. Paste it in `config.js`:
   ```javascript
   const YT_API_KEY = "YOUR_KEY_HERE";
   ```

Free tier: 10,000 units/day (~99 search batches).

## 📺 Adding Your Own Commercials

1. Upload your video to YouTube (set as **Unlisted**)
2. Enable **embedding** in YouTube Studio → Advanced Settings
3. Copy the video ID from the URL
4. Add to `commercials.js`:
   ```javascript
   { id: "YOUR_VIDEO_ID", title: "My Commercial" }
   ```

Tips: Keep 15–60 seconds. Hard cut endings feel most authentic.

## 🌐 Deploy to GitHub Pages

```bash
git init
git add .
git commit -m "launch intergalactic tv"
git remote add origin https://github.com/YOUR_USERNAME/intergalactic-tv.git
git push -u origin main
```

Then: Settings → Pages → Source: main → / (root)

**Important:** If using an API key, keep the repo **private** or use a proxy.

## 🛠 Tech Stack

- HTML5 + CSS3 + Vanilla JavaScript
- YouTube IFrame Player API
- YouTube Data API v3 (optional)
- Web Audio API (procedural sounds)
- Google Fonts (VT323, Press Start 2P)
- Zero dependencies, zero build tools

## 📁 File Structure

```
├── index.html        Main entry point
├── style.css         All visual styles
├── app.js            Application controller
├── youtube.js        YouTube player engine
├── channels.js       Channel definitions
├── commercials.js    Commercial video IDs
├── effects.js        CRT effects engine
├── sounds.js         Procedural sound effects
├── config.js         API key (gitignored)
├── assets/
│   └── room-bg.jpg   Room background
└── README.md         This file
```

---

*No pause. No rewind. Just interdimensional cable.*

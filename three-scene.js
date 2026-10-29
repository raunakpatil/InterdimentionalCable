// ══════════════════════════════════════════════════════════
//  INTERGALACTIC CABLE TV — 3D Room Environment
// ══════════════════════════════════════════════════════════
//
//  The Three.js room is the only view. The hidden DOM room is kept as
//  the CSS3D host for the TV/remote and as a static fallback if WebGL,
//  the GLB, or the connection fails.
//
//  Model requirements (all optional):
//    - Empty / mesh named "Seat_Eye" at the seated eye position
//    - Empty / mesh named "TV_Center" at the TV screen centre
//    - Or a mesh named "TV_Screen" / "TV003_low" for the screen plane
//    - A mesh named "Beanbag" helps if there is no seat anchor
//
//  This module was tuned against "Corner of the Room (90's Teenager
//  Theme)", which uses Beanbag + TV.003_low (sanitised to TV003_low).
//  Other models still work through the generic fallbacks.
//
//  Query parameters:
//    ?3d=debug
//    ?model=./my-room.glb
//
//  Override defaults before this module loads:
//    <script>window.ROOM3D_CONFIG = { roomWidthMeters: 4.4 };</script>
// ══════════════════════════════════════════════════════════

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { CSS3DRenderer, CSS3DObject } from "three/addons/renderers/CSS3DRenderer.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const THREE_VERSION = "0.186.1";
const CDN_ROOT = `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/examples/jsm/`;

const DEFAULT_CONFIG = {
  // Try these in order. Rename the downloaded file to room.glb for the simplest setup.
  modelUrls: ["./room.glb", "./scene.glb", "./interdimensional-room.glb"],

  // Scale the whole model so the room is roughly this wide (metres).
  // 0 keeps the model's native scale when it already looks like a room.
  roomWidthMeters: 0,

  // Preferred object names. Exact matches win, then normalised exact
  // matches (Three.js strips dots: "TV.003_low" → "TV003_low"), then
  // normalised substring matches.
  seatAnchorNames: ["Seat_Eye", "SeatEye", "Camera_Seat", "Viewer_Seat", "Seat_Anchor", "SeatAnchor"],
  tvAnchorNames: ["TV_Center", "TV_Centre", "TV_Anchor", "TVAnchor"],
  screenMeshNames: ["TV_Screen", "TV_Screen_Plane", "TV_ScreenMesh", "TV003_low", "TV003", "Screen"],
  beanbagNames: ["Beanbag", "Bean_Bag", "Bean Bag", "Pouf", "Beanbag_Seat"],

  // Fallbacks when the model has no screen mesh.
  defaultScreenWidth: 0.56,
  defaultScreenHeight: 0.42,
  screenFit: 0.985,
  screenYawOffsetDeg: 0,

  // Seated eye height above the beanbag seat surface (metres), and
  // how far to lean back from the beanbag centre, away from the TV.
  eyeHeightAboveSeat: 0.66,
  seatOffsetMeters: 0.2,

  // Exact camera, placed by hand in _debug/camera-tool.html. Overrides
  // the beanbag-derived seat. Coordinates are floor-normalised metres.
  cameraEye: [-0.3602, 0.4929, 1.2047],
  cameraTarget: [-0.9852, 0.7323, 0.4569],

  // Camera framing. Must match the calibration page so the framed view
  // is reproduced exactly.
  fovDesktop: 60,
  fovPortrait: 60,
  // Horizontal look is deliberately tiny so the room stays framed.
  maxYawDeg: 4,
  maxPitchDeg: 8,
  introSeconds: 2.2,
  // 0 = stay exactly in the chosen seat from the first frame.
  introDistance: 0,

  // The bundled room is an open-top corner set, so close it with a
  // simple painted ceiling that sits on top of the walls.
  addCeiling: true,
  ceilingColor: 0xffffff,
  ceilingEmissiveIntensity: 0.3,

  // The user's poster wall. The manifest lives in posters.js so the
  // gallery can change without touching the 3D renderer.
  addPosterGallery: true,
  cleanWallCollage: true,
  posterWallOffset: 0.005,

  // The model includes a paper-airplane mobile hanging from the ceiling
  // in front of the poster wall. Hide it to keep the gallery readable.
  removeHangingMobile: true,

  // The room sits inside an equirectangular night panorama that shows
  // through both windows. The 8K source is resized to a 4K WebP for web.
  addWindowView: true,
  windowViewUrl: "./assets/rogland_clear_night_4k.webp",
  windowViewIntensity: 1,
  windowViewYawDeg: 0,
  // Negative values pan the stars left-to-right. A full loop takes 7.5 minutes.
  windowViewDriftDegPerSecond: -0.8,

  // Lighting. Keep these low if the model uses baked lighting.
  hemisphereIntensity: 0.9,
  windowLightIntensity: 1.2,
  tvLightOnIntensity: 1.6,
  environmentIntensity: 0.35,
  exposure: 1.05,

  // Performance.
  maxPixelRatio: 2,
  maxMobilePixelRatio: 1.5,
  adaptiveQuality: true,
};

const CONFIG = { ...DEFAULT_CONFIG, ...(window.ROOM3D_CONFIG || {}) };

const query = new URLSearchParams(window.location.search);
const modeParam = (query.get("3d") || "").toLowerCase();
const debug = modeParam === "debug";

if (query.get("model")) {
  CONFIG.modelUrls = [query.get("model"), ...CONFIG.modelUrls];
}

// Optional explicit camera for calibration / hand-authored views:
//   ?eye=-0.33,1.27,1.44&target=-0.99,0.73,0.46&fov=50
function parseVec3(value) {
  if (!value) return null;
  const parts = value.split(",").map(Number);
  return parts.length === 3 && parts.every(Number.isFinite) ? parts : null;
}

if (query.get("eye")) {
  const eye = parseVec3(query.get("eye"));
  if (eye) CONFIG.cameraEye = eye;
}
if (query.get("target")) {
  const target = parseVec3(query.get("target"));
  if (target) CONFIG.cameraTarget = target;
}
if (query.get("fov")) {
  const fov = Number(query.get("fov"));
  if (Number.isFinite(fov) && fov >= 20 && fov <= 100) {
    CONFIG.fovDesktop = fov;
    CONFIG.fovPortrait = fov;
  }
}

const STATE = {
  glassMaterials: [],
  curtainTime: { value: 0 },
  active: false,
  deferred: false,
  loading: false,
  modelUrl: null,
  scene: null,
  room: null,
  camera: null,
  renderer: null,
  cssRenderer: null,
  cssScene: null,
  tvScreen: null,
  tvLight: null,
  hemisphere: null,
  windowLight: null,
  ceilingMaterial: null,
  seatEye: null,
  tvTarget: null,
  baseQuaternion: null,
  forward: null,
  introStarted: 0,
  introMix: 0,
  powerMix: 0,
  yaw: 0,
  pitch: 0,
  targetYaw: 0,
  targetPitch: 0,
  reducedMotion: false,
  hasFinePointer: false,
  abortController: null,
  qualityCheckedAt: 0,
  frameTime: 16.7,
  downgraded: false,
  windowViewActive: false,
};

let statusEl = null;
let statusTimer = null;
let rafId = null;
let lastFrame = 0;

// ── Small UI helpers ─────────────────────────────────────
function setStatus(text, hideAfterMs = 0) {
  if (!statusEl) return;
  window.clearTimeout(statusTimer);
  if (!text) {
    statusEl.hidden = true;
    return;
  }
  statusEl.hidden = false;
  statusEl.textContent = text;
  if (hideAfterMs > 0) {
    statusTimer = window.setTimeout(() => {
      statusEl.hidden = true;
    }, hideAfterMs);
  }
}

function setLoadingProgress(percent) {
  if (window.__roomLoader && typeof window.__roomLoader.progress === "function") {
    window.__roomLoader.progress(percent);
  }
}

function hideLoadingScreen() {
  if (window.__roomLoader && typeof window.__roomLoader.hide === "function") {
    window.__roomLoader.hide();
    return;
  }
  document.documentElement.classList.remove("room3d-pending");
}

function ensureUi() {
  if (!statusEl) {
    statusEl = document.createElement("div");
    statusEl.id = "room3d-status";
    statusEl.setAttribute("role", "status");
    statusEl.setAttribute("aria-live", "polite");
    statusEl.hidden = true;
    document.body.appendChild(statusEl);
  }
}

function log(...args) {
  if (debug) console.info("[3D room]", ...args);
}

function warn(...args) {
  console.warn("[3D room]", ...args);
}

// ── Capability checks ───────────────────────────────────
function webglAvailable() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext("webgl2") || canvas.getContext("webgl"))
    );
  } catch {
    return false;
  }
}

// ── Object lookup helpers ────────────────────────────────
function normalizeName(name) {
  return (name || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function findFirst(root, names) {
  for (const name of names) {
    const exact = root.getObjectByName(name);
    if (exact) return exact;
  }

  const needles = names.map(normalizeName).filter(Boolean);
  if (needles.length === 0) return null;

  // Normalised exact match: "TV.003_low" (glTF) → "TV003_low"
  // (Three.js sanitised) still matches the "TV003_low" needle.
  let found = null;
  root.traverse((object) => {
    if (found || !object.name) return;
    if (needles.includes(normalizeName(object.name))) found = object;
  });
  if (found) return found;

  // Last resort: substrings such as "Beanbag" inside "Beanbag_Seat".
  root.traverse((object) => {
    if (found || !object.name) return;
    const name = normalizeName(object.name);
    if (needles.some((needle) => name.includes(needle))) found = object;
  });
  return found;
}

function findMesh(object) {
  if (!object) return null;
  if (isMesh(object)) return object;
  let found = null;
  object.traverse((child) => {
    if (!found && child.isMesh) found = child;
  });
  return found;
}

function worldPosition(object, target = new THREE.Vector3()) {
  object.updateWorldMatrix(true, false);
  return object.getWorldPosition(target);
}

function worldCenter(object) {
  const box = new THREE.Box3().setFromObject(object);
  return box.getCenter(new THREE.Vector3());
}

function isMesh(object) {
  return Boolean(object && object.isMesh);
}

// ── Model discovery + normalisation ─────────────────────
async function findModelUrl() {
  for (const url of CONFIG.modelUrls) {
    try {
      const response = await fetch(url, { method: "HEAD", cache: "no-store" });
      if (response.ok) return url;
    } catch {
      /* try the next candidate */
    }
  }
  return null;
}

async function downloadModel(url, signal, onProgress) {
  const response = await fetch(url, { signal, cache: "force-cache" });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} while loading ${url}`);
  }

  const total = Number(response.headers.get("content-length")) || 0;
  if (!response.body || typeof response.body.getReader !== "function") {
    return await response.arrayBuffer();
  }

  const reader = response.body.getReader();
  const chunks = [];
  let loaded = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    onProgress(loaded, total);
  }

  const bytes = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes.buffer;
}

function normalizeRoom(room) {
  room.updateMatrixWorld(true);
  const initialBox = new THREE.Box3().setFromObject(room);
  const size = initialBox.getSize(new THREE.Vector3());

  if (!Number.isFinite(size.x) || size.x <= 0.0001) {
    warn("Model has no usable bounds; using its existing scale.");
    return;
  }

  let scale = 1;
  const targetWidth = Number(CONFIG.roomWidthMeters);

  if (targetWidth > 0) {
    scale = targetWidth / size.x;
  } else if (size.x > 50) {
    // Almost certainly centimetres or millimetres.
    scale = 4.2 / size.x;
  } else if (size.x < 1) {
    // A dollhouse-sized export; bring it up to room scale.
    scale = 4.2 / size.x;
  } else {
    log("Keeping native model scale:", size.toArray());
  }

  if (scale !== 1) {
    room.scale.multiplyScalar(scale);
    room.updateMatrixWorld(true);
    log("Room scaled by", scale.toFixed(3));
  }

  // Put the floor on y = 0 so light/camera heights are predictable.
  const scaledBox = new THREE.Box3().setFromObject(room);
  room.position.y -= scaledBox.min.y;
  room.updateMatrixWorld(true);

  const finalBox = new THREE.Box3().setFromObject(room);
  log("Room bounds:", finalBox.getSize(new THREE.Vector3()).toArray());
}

// ── Ceiling ──────────────────────────────────────────────
// "Corner of the Room" has two walls and a floor but no ceiling. Close
// the top with a white plane so looking up does not reveal the void.
function addCeiling(room) {
  if (!CONFIG.addCeiling) return null;

  const box = new THREE.Box3().setFromObject(room);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  if (size.x < 0.1 || size.z < 0.1) return null;

  const geometry = new THREE.PlaneGeometry(size.x, size.z);
  const material = new THREE.MeshStandardMaterial({
    color: CONFIG.ceilingColor,
    roughness: 0.96,
    metalness: 0,
    emissive: CONFIG.ceilingColor,
    emissiveIntensity: CONFIG.ceilingEmissiveIntensity,
    side: THREE.DoubleSide,
  });

  const ceiling = new THREE.Mesh(geometry, material);
  ceiling.name = "Room_Ceiling";
  // Plane normal points down, into the room.
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(center.x, box.max.y + 0.002, center.z);
  STATE.scene.add(ceiling);
  STATE.ceilingMaterial = material;
  log("Ceiling added at y =", ceiling.position.y.toFixed(3));
  return ceiling;
}

// ── Camera anchors ───────────────────────────────────────
function computeCameraView(room) {
  const seatAnchor = findFirst(room, CONFIG.seatAnchorNames);
  const tvAnchor = findFirst(room, CONFIG.tvAnchorNames);
  const screenMesh = findFirst(room, CONFIG.screenMeshNames);
  const beanbag = findFirst(room, CONFIG.beanbagNames);

  let target = null;
  if (tvAnchor) {
    target = isMesh(tvAnchor) ? worldCenter(tvAnchor) : worldPosition(tvAnchor);
    log("TV anchor:", tvAnchor.name, target.toArray());
  } else if (screenMesh) {
    target = worldCenter(screenMesh);
    warn("No TV_Center anchor found; using screen mesh centre.");
  }

  if (!target) {
    const roomBox = new THREE.Box3().setFromObject(room);
    target = roomBox.getCenter(new THREE.Vector3());
    warn("No TV anchor or screen mesh found; defaulting to room centre.");
  }

  let eye = null;
  if (seatAnchor) {
    eye = worldPosition(seatAnchor);
    if (!/eye/i.test(seatAnchor.name)) eye.y += CONFIG.eyeHeightAboveSeat;
    log("Seat anchor:", seatAnchor.name, eye.toArray());
  } else if (beanbag) {
    const seatBox = new THREE.Box3().setFromObject(beanbag);
    eye = seatBox.getCenter(new THREE.Vector3());
    eye.y = seatBox.max.y + CONFIG.eyeHeightAboveSeat;

    // Lean back, away from the TV, so the room reads around the screen.
    // Keep the eye over the beanbag so it still feels like sitting on it.
    const away = eye.clone().sub(target);
    away.y = 0;
    if (away.lengthSq() > 1e-6) {
      away.normalize();
      eye.addScaledVector(away, CONFIG.seatOffsetMeters);
    }
    eye.x = THREE.MathUtils.clamp(eye.x, seatBox.min.x + 0.04, seatBox.max.x - 0.04);
    eye.z = THREE.MathUtils.clamp(eye.z, seatBox.min.z + 0.04, seatBox.max.z - 0.04);

    warn("No Seat_Eye anchor found; using beanbag bounds + eye height.", {
      beanbag: beanbag.name,
      eye: eye.toArray(),
    });
  }

  if (!eye) {
    const roomBox = new THREE.Box3().setFromObject(room);
    const roomCenter = roomBox.getCenter(new THREE.Vector3());
    const direction = target.clone().sub(roomCenter);
    direction.y = 0;
    if (direction.lengthSq() < 1e-6) direction.set(0, 0, -1);
    direction.normalize();
    eye = target.clone().addScaledVector(direction, -2);
    eye.y = roomBox.min.y + 1.1;
    warn("No seat anchor or beanbag found; using a generic seated position.");
  }

  // Hand-authored / tool-generated view wins over the derived seat.
  if (Array.isArray(CONFIG.cameraEye) && CONFIG.cameraEye.length === 3) {
    eye = new THREE.Vector3().fromArray(CONFIG.cameraEye);
    log("Camera eye override:", eye.toArray());
  }
  if (Array.isArray(CONFIG.cameraTarget) && CONFIG.cameraTarget.length === 3) {
    target = new THREE.Vector3().fromArray(CONFIG.cameraTarget);
    log("Camera target override:", target.toArray());
  }

  const direction = target.clone().sub(eye);
  if (direction.lengthSq() < 1e-6) direction.set(0, 0, -1);
  direction.normalize();

  return { eye, target, direction, screenMesh, tvAnchor, beanbag };
}

function computeScreenInfo(room, view) {
  const { screenMesh } = view;
  let center = view.target.clone();
  let width = CONFIG.defaultScreenWidth;
  let height = CONFIG.defaultScreenHeight;
  let quaternion = null;
  let normal = null;

  const mesh = findMesh(screenMesh);
  if (mesh && mesh.geometry) {
    mesh.geometry.computeBoundingBox();
    const box = mesh.geometry.boundingBox;
    if (box) {
      mesh.updateWorldMatrix(true, false);
      const localSize = box.getSize(new THREE.Vector3());
      const worldScale = mesh.getWorldScale(new THREE.Vector3());
      const dims = [
        Math.abs(localSize.x * worldScale.x),
        Math.abs(localSize.y * worldScale.y),
        Math.abs(localSize.z * worldScale.z),
      ];
      const normalAxis = dims.indexOf(Math.min(...dims));
      const planar = [0, 1, 2].filter((index) => index !== normalAxis);
      const widthAxis = dims[planar[0]] >= dims[planar[1]] ? planar[0] : planar[1];
      const heightAxis = planar.find((index) => index !== widthAxis);
      const largest = Math.max(...dims);

      // A real screen is a thin slab: one axis is much smaller than the
      // other two. If it is not, fall back to facing the viewer.
      if (
        dims[widthAxis] > 0.03 &&
        dims[heightAxis] > 0.03 &&
        dims[normalAxis] < largest * 0.35
      ) {
        const axisVector = (index) => {
          const vector = new THREE.Vector3();
          vector.setComponent(index, 1);
          return vector.transformDirection(mesh.matrixWorld).normalize();
        };

        const fallbackUp = axisVector(heightAxis);
        const localCenter = box
          .getCenter(new THREE.Vector3())
          .applyMatrix4(mesh.matrixWorld);

        let front = axisVector(normalAxis);
        if (front.dot(view.eye.clone().sub(localCenter)) < 0) front.negate();

        let up = fallbackUp;
        if (up.dot(new THREE.Vector3(0, 1, 0)) < 0) up.negate();

        // CSS3D plane: +X right, +Y up, +Z out of the screen. Using
        // viewer-right keeps the video unmirrored regardless of how
        // the exporter authored the glass.
        const right = up.clone().cross(front).normalize();
        const basis = new THREE.Matrix4().makeBasis(right, up, front);

        center = localCenter;
        quaternion = new THREE.Quaternion().setFromRotationMatrix(basis);
        normal = front;
        width = dims[widthAxis];
        height = dims[heightAxis];

        log("Screen size from mesh:", {
          name: mesh.name,
          width: width.toFixed(3),
          height: height.toFixed(3),
          center: center.toArray(),
        });
      }
    }
  }

  if (!quaternion) {
    warn("No usable screen mesh; facing the CSS3D screen at the camera.");
    normal = view.eye.clone().sub(center).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const right = up.clone().cross(normal).normalize();
    const trueUp = normal.clone().cross(right).normalize();
    quaternion = new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(right, trueUp, normal)
    );
  }

  const fit = THREE.MathUtils.clamp(Number(CONFIG.screenFit) || 1, 0.5, 1);
  return {
    center,
    width: width * fit,
    height: height * fit,
    quaternion,
    normal,
  };
}

// ── Scene setup ──────────────────────────────────────────
function createRenderer() {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.domElement.id = "room-3d-canvas";
  renderer.setPixelRatio(
    Math.min(
      window.devicePixelRatio || 1,
      window.innerWidth <= 768 ? CONFIG.maxMobilePixelRatio : CONFIG.maxPixelRatio
    )
  );
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = CONFIG.exposure;
  renderer.setClearColor(0x050403, 1);

  const root = document.createElement("div");
  root.id = "room-3d-root";
  root.appendChild(renderer.domElement);
  document.body.insertBefore(root, document.body.firstChild);
  return renderer;
}

function createLoaders(renderer) {
  const loader = new GLTFLoader();

  const draco = new DRACOLoader();
  draco.setDecoderPath(`${CDN_ROOT}libs/draco/`);
  loader.setDRACOLoader(draco);

  const ktx2 = new KTX2Loader();
  ktx2.setTranscoderPath(`${CDN_ROOT}libs/basis/`);
  ktx2.detectSupport(renderer);
  loader.setKTX2Loader(ktx2);

  loader.setMeshoptDecoder(MeshoptDecoder);
  return loader;
}

function attachTvScreen(view, screenInfo) {
  const tvScreen = document.getElementById("tv-screen");
  if (!tvScreen) {
    warn("Could not find #tv-screen; cannot attach the TV to the 3D room.");
    return null;
  }

  const aspect = screenInfo.width / Math.max(screenInfo.height, 0.01);
  const pixelWidth = window.innerWidth <= 768 ? 768 : 1024;
  const pixelHeight = Math.max(1, Math.round(pixelWidth / aspect));

  const surface = document.createElement("div");
  surface.className = "tv-css3d-surface";
  surface.style.width = `${pixelWidth}px`;
  surface.style.height = `${pixelHeight}px`;

  // Move the existing screen (iframe, OSD, static, power overlay and all)
  // into the 3D scene. Only safe before the YouTube iframe exists.
  surface.appendChild(tvScreen);
  tvScreen.style.position = "absolute";
  tvScreen.style.inset = "0";
  tvScreen.style.width = "100%";
  tvScreen.style.height = "100%";

  // The glass in this model is nearly 5:4. Put the 16:9 player in a
  // centred 5:4 viewport and let it overscan slightly, like a real CRT.
  // OSD, static and the power-off overlay still cover the whole glass.
  // Query inside tvScreen: it has already been moved into the detached
  // surface above, so document.getElementById can no longer see it.
  const tvContent = tvScreen.querySelector("#tv-content");
  if (tvContent) {
    let viewport = tvScreen.querySelector(".tv-css3d-viewport");
    if (!viewport) {
      viewport = document.createElement("div");
      viewport.className = "tv-css3d-viewport";
      tvScreen.insertBefore(viewport, tvScreen.firstChild);
    }
    viewport.appendChild(tvContent);
  }

  const screenObject = new CSS3DObject(surface);
  screenObject.position.copy(screenInfo.center);
  screenObject.position.addScaledVector(screenInfo.normal, 0.004);
  screenObject.quaternion.copy(screenInfo.quaternion);
  if (CONFIG.screenYawOffsetDeg) {
    screenObject.rotateY(THREE.MathUtils.degToRad(CONFIG.screenYawOffsetDeg));
  }
  screenObject.scale.setScalar(screenInfo.width / pixelWidth);
  STATE.cssScene.add(screenObject);

  log("TV screen attached:", {
    worldWidth: screenInfo.width,
    worldHeight: screenInfo.height,
    pixelWidth,
    pixelHeight,
  });

  return screenObject;
}

function setupEnvironment(renderer) {
  try {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new RoomEnvironment();
    const envTarget = pmrem.fromScene(envScene, 0.04);
    STATE.scene.environment = envTarget.texture;
    STATE.scene.environmentIntensity = CONFIG.environmentIntensity;
    if (typeof envScene.dispose === "function") envScene.dispose();
    pmrem.dispose();
  } catch (error) {
    warn("Could not build the environment map:", error);
  }
}

// ── CRT glow ─────────────────────────────────────────────
// The YouTube frame is cross-origin, so its pixels can't be sampled.
// Fake what a picture does to a dark room instead: a new colour and
// brightness at every "cut", slow drift within the shot and a faint
// flicker. While static is on screen the glow turns grey-white and crackles.
const TV_GLOW_PALETTE = [
  0x8fb4ff, 0xffd2a0, 0xa8ffcf, 0xff9fb8, 0xc6a8ff,
  0xfff1d6, 0x7fd6ff, 0xffb070, 0xb8c8d8, 0xe0ffa8,
];
const TV_GLOW = {
  color: new THREE.Color(0x9fc8ff),
  target: new THREE.Color(0x9fc8ff),
  level: 0.8,
  nextCut: 0,
};

function updateTvGlow(now, delta) {
  const staticOn = document
    .getElementById("static-overlay")
    ?.classList.contains("active");
  if (staticOn) {
    TV_GLOW.target.setRGB(0.86, 0.9, 0.95);
    TV_GLOW.nextCut = now;
    TV_GLOW.color.lerp(TV_GLOW.target, Math.min(1, delta * 10));
    return 0.55 + Math.random() * 0.35;
  }
  if (now >= TV_GLOW.nextCut) {
    const hex = TV_GLOW_PALETTE[Math.floor(Math.random() * TV_GLOW_PALETTE.length)];
    TV_GLOW.target.set(hex);
    TV_GLOW.level = 0.45 + Math.random() * 0.75;
    TV_GLOW.nextCut = now + 1800 + Math.random() * 4500;
  }
  TV_GLOW.color.lerp(TV_GLOW.target, Math.min(1, delta * 6));
  if (STATE.reducedMotion) return TV_GLOW.level;
  const t = now / 1000;
  const drift = Math.sin(t * 1.3) * 0.08 + Math.sin(t * 3.7) * 0.05;
  const flicker = (Math.random() - 0.5) * 0.05;
  return Math.max(0.2, TV_GLOW.level + drift + flicker);
}

function setupLights(room, screenObject) {
  const hemisphere = new THREE.HemisphereLight(0xa9c8ff, 0x24140c, CONFIG.hemisphereIntensity);
  STATE.scene.add(hemisphere);

  const windowLight = new THREE.DirectionalLight(0xffd7a3, CONFIG.windowLightIntensity);
  const roomBox = new THREE.Box3().setFromObject(room);
  const roomCenter = roomBox.getCenter(new THREE.Vector3());
  const roomSize = roomBox.getSize(new THREE.Vector3());
  windowLight.position.set(roomBox.min.x - 1.5, roomBox.max.y + 1.5, roomBox.min.z - 1.5);
  windowLight.target.position.copy(roomCenter);
  STATE.scene.add(windowLight);
  STATE.scene.add(windowLight.target);

  const reach = Math.max(2.5, roomSize.length() * 0.45);
  const tvLight = new THREE.PointLight(0x9fc8ff, 0, reach, 2);
  if (screenObject) {
    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(screenObject.quaternion);
    tvLight.position.copy(screenObject.position).addScaledVector(normal, 0.35);
  } else {
    tvLight.position.copy(roomCenter);
  }
  STATE.scene.add(tvLight);

  STATE.hemisphere = hemisphere;
  STATE.windowLight = windowLight;
  STATE.tvLight = tvLight;
}

// ── Wall poster gallery ──────────────────────────────────
//
// The bundled room has a poster collage baked into the textures of the
// two corner walls. The 30 prints below are hung over the clean wall,
// wrapping around the corner above the CRT. Everything is measured in
// floor-normalised metres, using the wall faces found in room.glb:
//   back wall  z = -0.3973   (x -1.53 .. -0.90)
//   left wall  x = -1.5348   (z -0.40 .. 0.13)
//
// The panels are sized to fill the clear wall from just above the CRT
// up to the ceiling (y ≈ 1.38 .. 2.83). The back wall gets three columns;
// its right column is narrower and holds the featured pop print at the
// bottom, where it is closest to the seat and fully visible over the TV.
const FEATURED_POSTER = "Pop Transformation";

const POSTER_PANELS = [
  {
    key: "back",
    count: 14,
    uRange: [-1.52, -0.92],
    yRange: [1.36, 2.83],
    columns: [0.2, 0.2, 0.18],
    columnGap: 0.012,
    rowGap: 0.01,
    maxPerColumn: [5, 5, 4],
    axis: "x",
    fixed: -0.3973 + CONFIG.posterWallOffset,
    rotationY: 0,
    feature: { column: 2, width: 0.2 },
  },
  {
    key: "left",
    count: 10,
    uRange: [-0.40, 0.04],
    yRange: [1.36, 2.83],
    columns: [0.21, 0.21],
    columnGap: 0.012,
    rowGap: 0.01,
    maxPerColumn: 5,
    axis: "z",
    fixed: -1.5348 + CONFIG.posterWallOffset,
    rotationY: Math.PI / 2,
  },
];

// The bundled model hangs a paper-airplane mobile over the poster wall.
// Remove the planes and their strings so the prints stay readable.
function removeHangingMobile(room) {
  if (!CONFIG.removeHangingMobile) return;

  const mobile = [];
  room.traverse((object) => {
    if (/^Plane\d+/i.test(object.name)) mobile.push(object);
  });
  for (const object of mobile) object.removeFromParent();
  if (mobile.length) log("Hanging mobile removed:", mobile.length, "meshes");
}

// The stock window glass is a milky 25%-opaque white pane. That washes
// out the night sky and reads as a white shine. Leave only a faint cool
// tint so the panorama is the bright, contrasty part of the window.
function softenWindowGlass(room) {
  room.traverse((object) => {
    if (!object.isMesh) return;
    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    for (const material of materials) {
      if (!material) continue;
      const isGlass =
        /glass/i.test(material.name || "") || /^Glass/i.test(object.name);
      if (!isGlass) continue;
      material.transparent = true;
      material.opacity = 0.06;
      if (material.color) material.color.set(0xa8c0d0);
      if ("metalness" in material) material.metalness = 0;
      if ("roughness" in material) material.roughness = 1;
      material.envMapIntensity = 0;
      material.depthWrite = false;
      material.needsUpdate = true;
      STATE.glassMaterials.push(material);
    }
  });
  log("Window glass softened");
}

// A slow, faint sway for the two curtains, done in the vertex shader so
// the mesh stays untouched. Movement grows toward the hem; the rod line
// stays put. Each curtain gets its own phase so they don't move in step.
function animateCurtains(room) {
  room.updateMatrixWorld(true);
  let index = 0;
  room.traverse((object) => {
    if (!object.isMesh || !/^Curtain0\d_low_/i.test(object.name)) return;
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const inverse = object.matrixWorld.clone().invert();
    const toLocal = (v) => v.clone().transformDirection(inverse);
    const scale = new THREE.Vector3().setFromMatrixScale(object.matrixWorld).x || 1;
    const depthAxis = size.x < size.z ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);
    const sideAxis = size.x < size.z ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
    const up = toLocal(new THREE.Vector3(0, 1, 0));
    const topLocal = box.max.clone().applyMatrix4(inverse).dot(up);
    const uniforms = {
      uCurtainTime: STATE.curtainTime,
      uCurtainUp: { value: up },
      uCurtainDepth: { value: toLocal(depthAxis) },
      uCurtainSide: { value: toLocal(sideAxis) },
      uCurtainTop: { value: topLocal },
      uCurtainLength: { value: size.y / scale },
      uCurtainScale: { value: scale },
      uCurtainPhase: { value: index * 2.3 },
    };
    index += 1;
    const material = object.material.clone();
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          `#include <common>
uniform float uCurtainTime, uCurtainTop, uCurtainLength, uCurtainScale, uCurtainPhase;
uniform vec3 uCurtainUp, uCurtainDepth, uCurtainSide;`
        )
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
float hang = clamp((uCurtainTop - dot(transformed, uCurtainUp)) / uCurtainLength, 0.0, 1.0);
float across = dot(transformed, uCurtainSide) * uCurtainScale;
float t = uCurtainTime + uCurtainPhase;
float wave = sin(t * 0.7 + across * 3.0) * 0.6 + sin(t * 1.15 + across * 7.0) * 0.4;
transformed += uCurtainDepth * (hang * hang * wave * 0.012 / uCurtainScale);
transformed += uCurtainSide * (hang * hang * sin(t * 0.5) * 0.006 / uCurtainScale);`
        );
    };
    object.material = material;
  });
  if (index) log("Curtain sway enabled:", index, "meshes");
}

// Pixel rectangles that contain the old collage in the two 1024×1024
// wall textures. The paint is a flat #90d0ed, so the patches blend into
// the wall; the one star that overlaps the left-wall patch is restored
// from the original pixels afterwards.
const WALL_COLLAGE_RECTS = {
  Wall001: {
    fills: [
      [660, 197, 772, 645],
      [772, 178, 940, 645],
    ],
  },
  Wall002: {
    fills: [[8, 220, 288, 752]],
    restore: { x: 225, y: 314, w: 55, h: 38 },
  },
};

function cleanWallCollage(room) {
  if (!CONFIG.cleanWallCollage) return;

  const paint = [144, 208, 237];
  room.traverse((object) => {
    if (!object.isMesh || !object.material) return;
    const spec = object.name.includes("Wall001")
      ? WALL_COLLAGE_RECTS.Wall001
      : object.name.includes("Wall002")
        ? WALL_COLLAGE_RECTS.Wall002
        : null;
    if (!spec) return;

    const material = Array.isArray(object.material) ? object.material[0] : object.material;
    const map = material && material.map;
    const image = map && map.image;
    if (!image) return;

    const canvas = document.createElement("canvas");
    canvas.width = image.width || 1024;
    canvas.height = image.height || 1024;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(image, 0, 0);

    let restore = null;
    if (spec.restore) {
      const { x, y, w, h } = spec.restore;
      restore = { x, y, w, h, data: context.getImageData(x, y, w, h) };
    }

    context.fillStyle = `rgb(${paint[0]}, ${paint[1]}, ${paint[2]})`;
    for (const [x0, y0, x1, y1] of spec.fills) {
      context.fillRect(x0, y0, x1 - x0, y1 - y0);
    }

    if (restore) {
      const target = context.getImageData(restore.x, restore.y, restore.w, restore.h);
      const source = restore.data.data;
      const pixels = target.data;
      for (let i = 0; i < source.length; i += 4) {
        const r = source[i];
        const g = source[i + 1];
        const b = source[i + 2];
        // Put the yellow five-point star back without any poster yellows.
        if (r > 195 && g > 180 && b < 170 && r > b + 40) {
          pixels[i] = r;
          pixels[i + 1] = g;
          pixels[i + 2] = b;
          pixels[i + 3] = source[i + 3];
        }
      }
      context.putImageData(target, restore.x, restore.y);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.flipY = false;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = map.wrapS;
    texture.wrapT = map.wrapT;
    texture.magFilter = map.magFilter;
    texture.minFilter = map.minFilter;
    texture.anisotropy = map.anisotropy || 1;
    texture.needsUpdate = true;

    material.map = texture;
    material.needsUpdate = true;
    if (typeof map.dispose === "function") map.dispose();
    log("Wall collage cleaned:", object.name);
  });
}

async function loadPosterTextures(onProgress) {
  const posters = Array.isArray(window.ROOM_POSTERS) ? window.ROOM_POSTERS : [];
  if (!posters.length) {
    log("No poster manifest found; skipping the wall gallery.");
    return [];
  }

  const loader = new THREE.TextureLoader();
  const maxAnisotropy = STATE.renderer
    ? STATE.renderer.capabilities.getMaxAnisotropy()
    : 1;
  let finished = 0;

  const results = await Promise.allSettled(
    posters.map(async (poster) => {
      const texture = await loader.loadAsync(poster.src);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(8, maxAnisotropy);
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.needsUpdate = true;
      finished += 1;
      if (onProgress) onProgress(finished, posters.length);
      return { poster, texture };
    })
  );

  const loaded = [];
  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      loaded.push(result.value);
    } else {
      warn("Poster failed to load:", posters[index].src, result.reason);
    }
  });
  log(`Posters loaded: ${loaded.length}/${posters.length}`);
  return loaded;
}

async function loadWindowView() {
  if (!CONFIG.addWindowView || !CONFIG.windowViewUrl) return null;

  try {
    const texture = await new THREE.TextureLoader().loadAsync(CONFIG.windowViewUrl);
    texture.mapping = THREE.EquirectangularReflectionMapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.needsUpdate = true;
    log("Window view loaded:", CONFIG.windowViewUrl);
    return texture;
  } catch (error) {
    warn("Window view failed to load:", CONFIG.windowViewUrl, error);
    return null;
  }
}

function applyWindowView(texture) {
  if (!texture) return;
  STATE.scene.background = texture;
  STATE.scene.backgroundIntensity = CONFIG.windowViewIntensity;
  STATE.scene.backgroundRotation.set(
    0,
    THREE.MathUtils.degToRad(CONFIG.windowViewYawDeg),
    0
  );
  STATE.scene.backgroundBlurriness = 0;
  STATE.windowViewActive = true;
}

function columnLimit(panel, index) {
  if (Array.isArray(panel.maxPerColumn)) {
    return panel.maxPerColumn[index] ?? panel.maxPerColumn.at(-1);
  }
  return panel.maxPerColumn;
}

function layoutPosterPanel(panel, entries) {
  const columns = panel.columns.map(() => []);
  const heights = panel.columns.map(() => 0);

  const ordered = entries
    .map((entry) => ({
      entry,
      ratio: entry.poster.h / entry.poster.w,
    }))
    .sort((a, b) => b.ratio - a.ratio);

  for (const item of ordered) {
    let target = -1;
    for (let i = 0; i < columns.length; i += 1) {
      if (columns[i].length >= columnLimit(panel, i)) continue;
      if (target === -1 || heights[i] < heights[target]) target = i;
    }
    if (target === -1) break;
    const width = panel.columns[target];
    const height = width * item.ratio;
    columns[target].push({ ...item, width, height });
    heights[target] += height + panel.rowGap;
  }

  const contentWidth =
    panel.columns.reduce((sum, width) => sum + width, 0) +
    panel.columnGap * (panel.columns.length - 1);
  let u =
    panel.uRange[0] +
    (panel.uRange[1] - panel.uRange[0] - contentWidth) / 2;

  const placements = [];
  const columnCenters = [];
  columns.forEach((column, index) => {
    const width = panel.columns[index];
    let top = panel.yRange[1];
    columnCenters.push(u + width / 2);

    for (const item of column) {
      placements.push({
        entry: item.entry,
        width,
        height: item.height,
        centerU: u + width / 2,
        centerY: top - item.height / 2,
      });
      top -= item.height + panel.rowGap;
    }
    u += width + panel.columnGap;
  });

  return { placements, columnCenters };
}

function mountPoster(group, panel, entry, width, height, centerU, centerY, featured = false) {
  const { poster, texture } = entry;
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.92,
    metalness: 0,
    emissive: 0xffffff,
    emissiveMap: texture,
    emissiveIntensity: featured ? 0.08 : 0.05,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  mesh.name = `Poster_${panel.key}_${poster.title.replace(/\s+/g, "_")}`;

  if (panel.axis === "x") {
    mesh.position.set(centerU, centerY, panel.fixed);
  } else {
    mesh.position.set(panel.fixed, centerY, centerU);
    mesh.rotation.y = panel.rotationY;
  }
  group.add(mesh);
  return mesh;
}

// The top print of each column is moved below that column's lowest print.
// Every other print keeps its original position.
function wrapTopRow(group, panel) {
  const prefix = `Poster_${panel.key}_`;
  const columns = new Map();

  for (const mesh of group.children) {
    if (!mesh.name.startsWith(prefix)) continue;
    const u = panel.axis === "x" ? mesh.position.x : mesh.position.z;
    const key = u.toFixed(6);
    if (!columns.has(key)) columns.set(key, []);
    columns.get(key).push(mesh);
  }

  for (const column of columns.values()) {
    if (column.length < 2) continue;
    column.sort((a, b) => b.position.y - a.position.y);
    const top = column[0];
    const height = top.geometry.parameters.height;
    let lowestBottom = Infinity;
    for (const mesh of column) {
      lowestBottom = Math.min(
        lowestBottom,
        mesh.position.y - mesh.geometry.parameters.height / 2
      );
    }
    top.position.y = lowestBottom - panel.rowGap - height / 2;
  }
}

// The five `topRow` prints fill the empty slot above each column. They are
// mounted after the normal wrap so they do not take part in it. If a print is
// taller than the free gap, only that print is narrowed to fit; the existing
// row never moves.
function mountTopRow(group, panel, entries, columnCenters) {
  if (!entries.length) return;

  const prefix = `Poster_${panel.key}_`;
  const topEdges = columnCenters.map(() => 0);

  for (const mesh of group.children) {
    if (!mesh.name.startsWith(prefix)) continue;
    const u = panel.axis === "x" ? mesh.position.x : mesh.position.z;
    let column = 0;
    for (let i = 1; i < columnCenters.length; i += 1) {
      if (Math.abs(u - columnCenters[i]) < Math.abs(u - columnCenters[column])) {
        column = i;
      }
    }
    topEdges[column] = Math.max(
      topEdges[column],
      mesh.position.y + mesh.geometry.parameters.height / 2
    );
  }

  entries.forEach((entry, index) => {
    if (index >= panel.columns.length) return;
    const highest = topEdges[index] || panel.yRange[1];
    const gap = Math.max(0, panel.yRange[1] - highest - panel.rowGap);
    const ratio = entry.poster.h / entry.poster.w;
    const width = Math.min(panel.columns[index], gap / ratio);
    if (width < 0.04) return;
    const height = width * ratio;
    mountPoster(
      group,
      panel,
      entry,
      width,
      height,
      columnCenters[index],
      panel.yRange[1] - height / 2
    );
  });
}

function buildPosterGallery(entries) {
  if (!CONFIG.addPosterGallery || !entries.length) return null;

  const group = new THREE.Group();
  group.name = "Room_Poster_Gallery";

  // The pop-transformation print is the owner's favourite. Keep it out of
  // the masonry pool and mount it at the bottom of the back wall's right
  // column, closest to the seat and clear above the CRT.
  const featureEntry = entries.find(
    ({ poster }) => poster.title === FEATURED_POSTER
  );
  const topRowEntries = entries.filter(({ poster }) => poster.topRow === true);
  const regularEntries = entries.filter(
    (entry) => entry !== featureEntry && entry.poster.topRow !== true
  );
  let cursor = 0;
  let topRowCursor = 0;

  for (const panel of POSTER_PANELS) {
    const panelEntries = regularEntries.slice(cursor, cursor + panel.count);
    cursor += panel.count;
    if (!panelEntries.length) continue;

    const { placements, columnCenters } = layoutPosterPanel(panel, panelEntries);
    for (const placement of placements) {
      mountPoster(
        group,
        panel,
        placement.entry,
        placement.width,
        placement.height,
        placement.centerU,
        placement.centerY
      );
    }

    if (featureEntry && panel.feature) {
      const columnIndex = panel.feature.column;
      const width = panel.feature.width;
      const height = width * (featureEntry.poster.h / featureEntry.poster.w);
      const centerU = columnCenters[columnIndex];
      let lowest = panel.yRange[1];
      for (const placement of placements) {
        if (Math.abs(placement.centerU - centerU) < 1e-6) {
          lowest = Math.min(lowest, placement.centerY - placement.height / 2);
        }
      }
      mountPoster(
        group,
        panel,
        featureEntry,
        width,
        height,
        centerU,
        lowest - panel.rowGap - height / 2,
        true
      );
    }

    wrapTopRow(group, panel);

    const topCount = panel.columns.length;
    const panelTopEntries = topRowEntries.slice(
      topRowCursor,
      topRowCursor + topCount
    );
    topRowCursor += topCount;
    mountTopRow(group, panel, panelTopEntries, columnCenters);
  }

  if (featureEntry && !group.children.some((child) => child.name.includes(FEATURED_POSTER.replace(/\s+/g, "_")))) {
    warn("Featured poster panel missing; using the regular gallery.");
  }

  STATE.scene.add(group);
  log("Poster gallery:", group.children.length, "prints");
  return group;
}

// ── Activation ───────────────────────────────────────────
function activate(gltf, url, posterEntries = [], windowView = null) {
  const playerActive = hasPlayer();
  const powered = document.body.classList.contains("tv-on");

  if (playerActive || powered) {
    STATE.deferred = true;
    hideLoadingScreen();
    setStatus("Reload to enter the 3D room.", 6000);
    log("Activation deferred until the next page load (player already active).");
    return;
  }

  const room = gltf.scene;
  normalizeRoom(room);
  STATE.scene.add(room);
  STATE.room = room;
  addCeiling(room);
  cleanWallCollage(room);
  removeHangingMobile(room);
  softenWindowGlass(room);
  if (!STATE.reducedMotion) animateCurtains(room);

  const view = computeCameraView(room);
  STATE.seatEye = view.eye;
  STATE.tvTarget = view.target;
  STATE.forward = view.direction;

  const camera = STATE.camera;
  camera.position.copy(view.eye);
  camera.lookAt(view.target);
  STATE.baseQuaternion = camera.quaternion.clone();

  const screenInfo = computeScreenInfo(room, view);
  const screenObject = attachTvScreen(view, screenInfo);
  setupEnvironment(STATE.renderer);
  setupLights(room, screenObject);
  applyWindowView(windowView);
  buildPosterGallery(posterEntries);

  if (debug) {
    document.body.classList.add("room3d-debug");
    STATE.scene.add(new THREE.AxesHelper(2));
    STATE.scene.add(new THREE.BoxHelper(room, 0x00ff88));
    const seatMarker = new THREE.Mesh(
      new THREE.SphereGeometry(0.025, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0x00ff88 })
    );
    seatMarker.position.copy(view.eye);
    STATE.scene.add(seatMarker);
    const targetMarker = new THREE.Mesh(
      new THREE.SphereGeometry(0.025, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xff3366 })
    );
    targetMarker.position.copy(view.target);
    STATE.scene.add(targetMarker);
  }

  STATE.active = true;
  STATE.modelUrl = url;
  document.body.classList.add("env-3d");
  ensureUi();
  setStatus("", 0);
  STATE.renderer.domElement.parentElement?.classList.add("is-ready");

  STATE.introStarted = performance.now();
  STATE.qualityCheckedAt = performance.now();
  STATE.introMix = STATE.reducedMotion ? 1 : 0;

  if (!STATE.reducedMotion && STATE.hasFinePointer) {
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerleave", resetPointer, { passive: true });
  }

  startLoop();
  setLoadingProgress(100);
  // Let the first WebGL frame paint under the boot screen, then fade it.
  requestAnimationFrame(() => {
    requestAnimationFrame(hideLoadingScreen);
  });
  // rAF is throttled in background tabs; never let the boot screen outlive
  // a room that has already loaded.
  window.setTimeout(hideLoadingScreen, 400);
  log("3D room active:", url);

  // If the viewer pressed power while the room was loading, the press was
  // queued. Render one CSS3D frame first so the TV DOM is attached, then
  // honour the press with the set already mounted in the 3D scene.
  if (window.__pendingPowerOn) {
    STATE.renderer.render(STATE.scene, camera);
    STATE.cssRenderer.render(STATE.cssScene, camera);
    window.__pendingPowerOn = false;
    if (typeof window.powerOn === "function") window.powerOn();
  }
}

function handlePointerMove(event) {
  // Using the remote (or any page UI) should not swing the camera away
  // from the TV; recentre while the pointer is over interactive chrome.
  const target = event.target;
  if (
    target instanceof Element &&
    target.closest(
      "#remote-control, #room3d-status, #creator-footer, " +
        "#settings-modal, #splash-screen, button, a, input, select, textarea"
    )
  ) {
    resetPointer();
    return;
  }

  const yaw = (event.clientX / window.innerWidth - 0.5) * 2;
  const pitch = (event.clientY / window.innerHeight - 0.5) * 2;
  // Moving the pointer left looks left, right looks right.
  STATE.targetYaw = -THREE.MathUtils.degToRad(CONFIG.maxYawDeg) * yaw;
  STATE.targetPitch = -THREE.MathUtils.degToRad(CONFIG.maxPitchDeg) * pitch;
}

function resetPointer() {
  STATE.targetYaw = 0;
  STATE.targetPitch = 0;
}

// ── Animation loop ───────────────────────────────────────
function startLoop() {
  if (rafId !== null) return;
  lastFrame = performance.now();
  rafId = requestAnimationFrame(tick);
}

function stopLoop() {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}

function tick(now) {
  rafId = requestAnimationFrame(tick);
  const delta = Math.min((now - lastFrame) / 1000, 0.05);
  lastFrame = now;

  const camera = STATE.camera;
  const seatEye = STATE.seatEye;
  const forward = STATE.forward;
  if (!camera || !seatEye || !forward) return;

  // Intro dolly: a gentle push-in from just behind the beanbag.
  if (!STATE.reducedMotion && STATE.introMix < 1) {
    const elapsed = (now - STATE.introStarted) / 1000;
    const t = Math.min(elapsed / CONFIG.introSeconds, 1);
    STATE.introMix = 1 - Math.pow(1 - t, 3);
  }

  const tvOn = document.body.classList.contains("tv-on");
  STATE.powerMix += ((tvOn ? 1 : 0) - STATE.powerMix) * Math.min(1, delta * 4.5);

  camera.position.copy(seatEye);
  camera.position.addScaledVector(forward, -(1 - STATE.introMix) * CONFIG.introDistance);
  if (!STATE.reducedMotion) {
    camera.position.y += Math.sin(now * 0.0011) * 0.003;
  }

  // Subtle, clamped look parallax for mice. Touch gestures remain channel swipes.
  const smoothing = 1 - Math.exp(-delta * 6);
  STATE.yaw += (STATE.targetYaw - STATE.yaw) * smoothing;
  STATE.pitch += (STATE.targetPitch - STATE.pitch) * smoothing;
  const lookQuaternion = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(STATE.pitch, STATE.yaw, 0, "YXZ")
  );
  camera.quaternion.copy(STATE.baseQuaternion).multiply(lookQuaternion);

  // Drift the equirectangular night sky horizontally. Wrapping at 2π keeps
  // the motion seamless; reducing motion leaves the stars fixed.
  if (
    STATE.windowViewActive &&
    !STATE.reducedMotion &&
    CONFIG.windowViewDriftDegPerSecond
  ) {
    const turn = Math.PI * 2;
    const drift =
      THREE.MathUtils.degToRad(CONFIG.windowViewDriftDegPerSecond) * delta;
    STATE.scene.backgroundRotation.y =
      ((STATE.scene.backgroundRotation.y + drift) % turn + turn) % turn;
  }

  if (STATE.tvLight) {
    const glow = tvOn ? updateTvGlow(now, delta) : 0;
    STATE.tvLight.intensity +=
      (CONFIG.tvLightOnIntensity * glow - STATE.tvLight.intensity) *
      Math.min(1, delta * 12);
    STATE.tvLight.color.lerp(TV_GLOW.color, Math.min(1, delta * 10));
  }

  // TV on = room lights off. The CRT becomes the only light source, with
  // the hemisphere, window and image-based lighting fading to zero.
  const roomLightMix = 1 - STATE.powerMix;
  STATE.curtainTime.value = now / 1000;
  // The glass picks up the CRT glow as a pale sheen; hide it with the lights.
  for (const material of STATE.glassMaterials) {
    material.opacity = 0.06 * roomLightMix;
    material.visible = material.opacity > 0.002;
  }
  if (STATE.scene.environment) {
    const target = CONFIG.environmentIntensity * roomLightMix;
    STATE.scene.environmentIntensity +=
      (target - STATE.scene.environmentIntensity) * Math.min(1, delta * 3);
  }
  if (STATE.hemisphere) {
    const target = CONFIG.hemisphereIntensity * roomLightMix;
    STATE.hemisphere.intensity +=
      (target - STATE.hemisphere.intensity) * Math.min(1, delta * 3);
  }
  if (STATE.windowLight) {
    const target = CONFIG.windowLightIntensity * roomLightMix;
    STATE.windowLight.intensity +=
      (target - STATE.windowLight.intensity) * Math.min(1, delta * 3);
  }
  if (STATE.ceilingMaterial) {
    const target = CONFIG.ceilingEmissiveIntensity * roomLightMix;
    STATE.ceilingMaterial.emissiveIntensity +=
      (target - STATE.ceilingMaterial.emissiveIntensity) *
      Math.min(1, delta * 3);
  }

  // If the model is heavy, drop the pixel ratio once rather than
  // letting the whole room stutter. The CSS3D TV is unaffected.
  STATE.frameTime += (delta * 1000 - STATE.frameTime) * 0.05;
  if (
    CONFIG.adaptiveQuality &&
    !STATE.downgraded &&
    now - STATE.qualityCheckedAt > 3000
  ) {
    STATE.qualityCheckedAt = now;
    if (STATE.frameTime > 26 && STATE.renderer.getPixelRatio() > 1.01) {
      STATE.renderer.setPixelRatio(1);
      STATE.downgraded = true;
      log("Adaptive quality: pixel ratio reduced to 1.");
    }
  }

  STATE.renderer.render(STATE.scene, camera);
  STATE.cssRenderer.render(STATE.cssScene, camera);
}

// ── Resize / visibility ─────────────────────────────────
function onResize() {
  if (!STATE.active) return;
  const width = window.innerWidth;
  const height = window.innerHeight;
  STATE.camera.aspect = width / height;
  STATE.camera.fov = width / height < 1 ? CONFIG.fovPortrait : CONFIG.fovDesktop;
  STATE.camera.updateProjectionMatrix();
  STATE.renderer.setPixelRatio(
    STATE.downgraded
      ? 1
      : Math.min(
          window.devicePixelRatio || 1,
          width <= 768 ? CONFIG.maxMobilePixelRatio : CONFIG.maxPixelRatio
        )
  );
  STATE.renderer.setSize(width, height);
  STATE.cssRenderer.setSize(width, height);
}

function onVisibilityChange() {
  if (document.hidden) {
    stopLoop();
  } else if (STATE.active) {
    lastFrame = performance.now();
    startLoop();
  }
}

// ── Public hooks used by app.js ─────────────────────────
function handlePowerOff() {
  // In 3D mode we can reset in place; no page reload and no model re-parse.
  if (!STATE.active) return false;
  setStatus("", 0);
  return true;
}

window.Environment3D = {
  get active() {
    return STATE.active;
  },
  get deferred() {
    return STATE.deferred;
  },
  get scene() {
    return STATE.scene;
  },
  get camera() {
    return STATE.camera;
  },
  get renderer() {
    return STATE.renderer;
  },
  handlePowerOff,
  resync: onResize,
};

// ── Boot ─────────────────────────────────────────────────
function hasPlayer() {
  const playerEl = document.getElementById("yt-player");
  return Boolean(playerEl && playerEl.tagName === "IFRAME");
}

async function init() {
  ensureUi();

  if (!webglAvailable()) {
    hideLoadingScreen();
    warn("WebGL unavailable; showing the static room.");
    return;
  }

  STATE.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  STATE.hasFinePointer = window.matchMedia("(pointer: fine)").matches;

  // Never start a large model download if a player is already alive.
  if (
    document.body.classList.contains("tv-on") ||
    hasPlayer()
  ) {
    STATE.deferred = true;
    hideLoadingScreen();
    setStatus("Reload to enter the 3D room.", 5000);
    log("3D deferred (a player is already active).");
    return;
  }

  setLoadingProgress(8);
  setStatus("LOOKING FOR THE 3D ROOM…");
  const url = await findModelUrl();
  if (!url) {
    setStatus(
      "3D room not found. Put room.glb in the site root, or use ?model=./your.glb.",
      0
    );
    warn("No model found. Candidates:", CONFIG.modelUrls.join(", "));
    hideLoadingScreen();
    return;
  }

  STATE.modelUrl = url;

  // The viewer may have turned the set on while the HEAD request ran.
  if (
    document.body.classList.contains("tv-on") ||
    hasPlayer()
  ) {
    STATE.deferred = true;
    hideLoadingScreen();
    setStatus("Reload to enter the 3D room.", 5000);
    log("3D deferred (a player is already active).");
    return;
  }

  const renderer = createRenderer();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050403);
  const camera = new THREE.PerspectiveCamera(
    window.innerWidth / window.innerHeight < 1 ? CONFIG.fovPortrait : CONFIG.fovDesktop,
    window.innerWidth / window.innerHeight,
    0.05,
    60
  );

  const cssRenderer = new CSS3DRenderer();
  cssRenderer.setSize(window.innerWidth, window.innerHeight);
  cssRenderer.domElement.id = "room-3d-css";
  document.body.appendChild(cssRenderer.domElement);

  STATE.renderer = renderer;
  STATE.scene = scene;
  STATE.camera = camera;
  STATE.cssRenderer = cssRenderer;
  STATE.cssScene = new THREE.Scene();

  renderer.domElement.addEventListener(
    "webglcontextlost",
    (event) => {
      event.preventDefault();
      stopLoop();
      warn("WebGL context lost. Reload to rebuild the 3D room.");
    },
    false
  );

  const loader = createLoaders(renderer);
  const abortController = new AbortController();
  STATE.abortController = abortController;
  STATE.loading = true;
  setStatus("LOADING 3D ROOM… 0%");

  let gltf;
  let posterEntries = [];
  let windowView = null;
  try {
    const buffer = await downloadModel(url, abortController.signal, (loaded, total) => {
      if (total > 0) {
        const percent = Math.min(100, Math.round((loaded / total) * 100));
        setStatus(`LOADING 3D ROOM… ${percent}%`);
        setLoadingProgress(10 + percent * 0.8);
      } else {
        setStatus(`LOADING 3D ROOM… ${(loaded / 1048576).toFixed(1)} MB`);
      }
    });

    if (abortController.signal.aborted) {
      hideLoadingScreen();
      return;
    }

    // The viewer may have turned the set on while the file was in flight.
    if (document.body.classList.contains("tv-on")) {
      STATE.deferred = true;
      hideLoadingScreen();
      setStatus("3D room will load on the next visit.", 5000);
      return;
    }

    setLoadingProgress(94);
    setStatus("PREPARING 3D ROOM…");
    const basePath = new URL("./", new URL(url, window.location.href)).href;
    gltf = await new Promise((resolve, reject) => {
      loader.parse(buffer, basePath, resolve, reject);
    });

    if (!abortController.signal.aborted && !document.body.classList.contains("tv-on")) {
      setLoadingProgress(95);
      setStatus("HANGING POSTERS…");
      posterEntries = await loadPosterTextures((done, total) => {
        setLoadingProgress(95 + Math.round((done / total) * 3));
      });
      setLoadingProgress(98);
      setStatus("OPENING THE WINDOW…");
      windowView = await loadWindowView();
    }

    if (abortController.signal.aborted) {
      hideLoadingScreen();
      return;
    }

    // The viewer may have turned the set on while the posters loaded.
    if (document.body.classList.contains("tv-on") || hasPlayer()) {
      STATE.deferred = true;
      hideLoadingScreen();
      setStatus("3D room will load on the next visit.", 5000);
      return;
    }
  } catch (error) {
    if (error && error.name === "AbortError") {
      log("Model download aborted.");
      hideLoadingScreen();
      return;
    }
    warn("Failed to load 3D model:", error);
    hideLoadingScreen();
    setStatus(
      "Could not load the 3D room. Check the console or the model filename.",
      0
    );
    return;
  } finally {
    STATE.loading = false;
    STATE.abortController = null;
  }

  window.addEventListener("resize", onResize);
  document.addEventListener("visibilitychange", onVisibilityChange);
  activate(gltf, url, posterEntries, windowView);

  if (!STATE.active) {
    // Player was already running. Keep the room deferred until the next reload.
    stopLoop();
  }
}

init().catch((error) => {
  console.error("[3D room] Unexpected failure:", error);
  hideLoadingScreen();
  setStatus("", 0);
});

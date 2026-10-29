# 3D Room

The real-time 3D room is the only viewing mode. It is rendered from a fixed
seat on the beanbag, with the CRT, YouTube player, OSD, static and power effects
embedded in a modelled television.

The illustrated DOM room still exists in the page, but it is hidden
(`#room-container { display: none }`) while 3D is active. It serves two jobs:

- the CSS3D host for `#tv-screen` and everything inside it;
- a static fallback if WebGL, the model, or the network fails.

There is no 2D/3D toggle, no saved viewing preference, no `?3d=off`, and no
automatic 2D mode on phones.

The bundled room is [Corner of the Room (90's Teenager Theme)](https://sketchfab.com/)
optimised to `room.glb` (5.63 MiB, Meshopt geometry + WebP textures, native
scale). The 65 MB source download is intentionally not in git.

---

## Startup

Every visit starts the 3D room. An early inline script puts a full-screen boot
screen over the page before anything can paint, then `three-scene.js` loads the
model, the 25 wall posters and the 360° night sky behind it.

`?3d=debug` is the only 3D query parameter left. It adds `[3D room]` console
logging and debug helpers. Legacy `?3d=on`, `?3d=off` and `?3d=2d` are ignored.

### Boot screen

The boot screen shows **INTERDIMENSIONAL TV** and a thin progress bar. It fades
out once the first WebGL frame is ready. The hidden DOM room never appears
behind it.

If the set is switched on while the model is still loading, the power press is
queued. The boot screen stays up, and the TV turns on inside the finished 3D
room once it is ready. The model download is not cancelled and the fallback room
is not shown.

If WebGL or the model is unavailable, the boot screen hides and the static DOM
room becomes visible with a status message. Reload to try 3D again.

---

## Configuration

Defaults live in `DEFAULT_CONFIG` at the top of `three-scene.js`. Override them
without editing the file by defining `window.ROOM3D_CONFIG` **before** the
module loads:

```html
<script>
  window.ROOM3D_CONFIG = {
    roomWidthMeters: 4.4,
    fovDesktop: 60,
    tvLightOnIntensity: 1.6,
  };
</script>
<script type="module" src="three-scene.js?v=89"></script>
```

| Key | Default | Purpose |
|-----|---------|---------|
| `modelUrls` | `["./room.glb", "./scene.glb", "./interdimensional-room.glb"]` | Candidates, first reachable wins |
| `roomWidthMeters` | `0` | Scale so the room is this wide; `0` keeps native scale |
| `seatAnchorNames` | `Seat_Eye`, `Camera_Seat`, … | Optional empty at the seated eye |
| `tvAnchorNames` | `TV_Center`, `TV_Anchor`, … | Optional empty at the screen centre |
| `screenMeshNames` | `TV_Screen`, `TV003_low`, … | Mesh used for the screen plane |
| `beanbagNames` | `Beanbag`, `Pouf`, … | Seat fallback when there is no anchor |
| `cameraEye` | `[-0.3602, 0.4929, 1.2047]` | Exact eye, overrides the seat |
| `cameraTarget` | `[-0.9852, 0.7323, 0.4569]` | Exact look-at point |
| `eyeHeightAboveSeat` | `0.66` | Used only when `cameraEye` is unset |
| `seatOffsetMeters` | `0.2` | Lean back from the beanbag centre |
| `fovDesktop` | `60` | Vertical field of view, landscape |
| `fovPortrait` | `60` | Vertical field of view, portrait |
| `maxYawDeg` | `4` | Mouse-look limit left/right |
| `maxPitchDeg` | `8` | Mouse-look limit up/down |
| `introDistance` | `0` | Start exactly in the seat; `>0` dollies in |
| `addCeiling` | `true` | Close open-top models with a painted ceiling |
| `ceilingColor` | `#ffffff` | Ceiling paint colour |
| `ceilingEmissiveIntensity` | `0.3` | Self-light; fades to 0 when the TV is on |
| `addPosterGallery` | `true` | Mount the 30-print wall gallery |
| `cleanWallCollage` | `true` | Paint the baked-in wall collage off at runtime |
| `posterWallOffset` | `0.005` | Gap between wall face and poster plane (metres) |
| `removeHangingMobile` | `true` | Remove the model's paper-airplane mobile |
| `addWindowView` | `true` | Show the 360° panorama through the windows |
| `windowViewUrl` | `./assets/rogland_clear_night_4k.webp` | Equirectangular night-sky image (2:1) |
| `windowViewIntensity` | `1` | Background brightness |
| `windowViewYawDeg` | `0` | Starting compass angle of the sky |
| `windowViewDriftDegPerSecond` | `-1.2` | Sky drift; negative pans the stars left-to-right (300 s loop) |
| `hemisphereIntensity` | `0.9` | Fill light; fades to 0 when the TV is on |
| `windowLightIntensity` | `1.2` | Sun through the window; fades to 0 when the TV is on |
| `tvLightOnIntensity` | `1.6` | CRT point light; the only light while the TV is on |
| `environmentIntensity` | `0.35` | Image-based ambient light; fades to 0 when the TV is on |
| `exposure` | `1.05` | ACES tone-mapping exposure |
| `maxPixelRatio` | `2` | Desktop render resolution cap |
| `maxMobilePixelRatio` | `1.5` | Mobile render resolution cap |
| `adaptiveQuality` | `true` | Drop resolution if frames stay slow |

The camera eye is fixed. The pointer only adds a small yaw (±4°) and pitch
(±8°), and pointer movement over the remote or any other UI recentres the view.

### Lighting

With the set off, the room is lit by the hemisphere fill, the window light, the
image-based environment and the ceiling's slight self-light. Turning the set on
fades all four to zero. The CRT point light is then the only light source in the
room.

### Query overrides

```text
?3d=debug&eye=-0.3602,0.4929,1.2047&target=-0.9852,0.7323,0.4569&fov=60
```

`eye`, `target` and `fov` win over the config. Coordinates are metres in the
floor-normalised space: the model is scaled (if needed), then translated so the
lowest point of the room sits at `y = 0`.

---

## Placing the camera

There is a local calibration page at `_debug/camera-tool.html` (ignored by git,
served from the site root). It loads the same `room.glb`, applies the same floor
normalisation, and reports the camera state live:

1. Serve the site over HTTP and open
   `http://127.0.0.1:8123/_debug/camera-tool.html`.
2. Drag to orbit, right-drag to pan, wheel to dolly, and use the FOV slider.
3. Press `H` to hide the panel and check the full frame.
4. **Copy values** for JSON, or **Copy app link** for a URL that reproduces the
   view exactly. `App seat` resets to the seat currently baked into the app.

Paste the values into `DEFAULT_CONFIG.cameraEye`, `cameraTarget` and
`fovDesktop` / `fovPortrait`, or test them first with the query overrides above.

The shipped seat is a low view from the beanbag toward the TV. The beanbag
appears at the bottom edge of the frame and can partially enter the frame when
looking far left or right; that is expected at this eye height.

---

## Replacing the room model

Any glTF/GLB scene works, but the automatic anchors rely on names:

- `Seat_Eye` (empty or mesh) — seated eye position. If absent, the beanbag
  bounds + `eyeHeightAboveSeat` are used.
- `TV_Center` / `TV_Anchor` (empty) — screen centre. If absent, the centre of
  the screen mesh is used.
- `TV_Screen`, `TV003_low` or `TV003` (mesh) — the plane the live TV is placed
  on.
- `Beanbag`, `Pouf`, `Beanbag_Seat` (mesh) — seat fallback.

Three.js sanitises dots and other characters in node names, so `TV.003_low`
becomes `TV003_low`; the lookup normalises names before matching.

To produce a web build from a large source file:

```bash
npx @gltf-transform/cli optimize source.glb room.glb \
  --compress meshopt --texture-compress webp
```

Keep the result next to `index.html` as `room.glb` (or point `?model=` at it).
Compression needs `MeshoptDecoder`; the module already configures Meshopt, Draco
and KTX2 loaders. If the model is in centimetres or is dollhouse-sized, set
`roomWidthMeters` (for example `4.4`) instead of pre-scaling it by hand.

---

## Wall poster gallery

The two corner walls carry 30 posters from `assets/posters/`, listed in
`posters.js` as `window.ROOM_POSTERS` (native-resolution WebP, 5.47 MiB for the
whole set).

- **Back wall:** 14 regular prints in three columns, three top-row prints, plus
  the featured **Pop Transformation** print at the bottom of the right column.
  The regular columns are 0.20 m, 0.20 m and 0.18 m wide; the feature is 0.20 m
  wide.
- **Left wall:** 10 regular prints and two top-row prints in two columns,
  0.21 m wide.
- The panels span `y 1.36..2.83`, filling the usable wall from just above the
  CRT to the ceiling.
- The highest original print in each column is wrapped to the bottom of that
  same column, below its lowest print. Every other print keeps its existing
  position, so the top of each column is left open. Because the bottom row
  already sits just above the CRT, the wrapped prints sit low on the wall and
  can be partly hidden by the TV or desk from the fixed seat.
- The five entries tagged `topRow: true` fill those open tops, one per column,
  so each column has a print at the ceiling again. A top-row print is narrowed
  slightly only when the free gap is shorter than the print; the original
  prints never move to make room.
- The featured print stays at the bottom of the back-right column, closest to
  the seat and fully visible above the CRT.

The bundled hanging airplane mobile is removed (`removeHangingMobile`) so it
cannot cover the prints. The clear back face is `x -1.53..-0.90`,
`y 1.35..2.87`; the clear left face is `z -0.40..0.13`, `y 1.35..2.87`.

The bundled room also ships with an old poster collage baked into the two wall
textures. At runtime the module repaints those texture rectangles to the flat
wall blue (`#90d0ed`) before the new gallery is mounted, restoring the one star
that overlaps the left-wall patch. Set `cleanWallCollage: false` to keep the
baked collage, or `addPosterGallery: false` to hide the new prints. Panel
bounds, widths and gaps are in `POSTER_PANELS` near the gallery code.

To change the gallery, replace the files in `assets/posters/` and update
`posters.js`:

```js
window.ROOM_POSTERS = [
  { src: "assets/posters/01-zathura.webp", w: 736, h: 1090, title: "Zathura" },
  // …
];
```

`w` and `h` are the source pixel dimensions; the layout uses their ratio so
prints are never distorted. Keep the 25 original entries in their current order
and append the `topRow: true` entries at the end. The current layout is
14 regular + 1 feature + 10 regular + 5 top-row = 30 prints, with the feature
named **Pop Transformation**. Posters are downloaded before the 3D room
activates, so they are covered by the boot screen and never pop in over a
finished frame.

---

## Window view

The room is placed inside a 360° desert-night panorama. The image is loaded as
an equirectangular `scene.background`, and the window glass is transparent, so
both windows look out onto the same sky.

The sky drifts slowly and seamlessly from left to right. Every frame adds
`windowViewDriftDegPerSecond` (default `-1.2°`) to
`scene.backgroundRotation.y`, so the stars pan across the windows and a full
loop takes five minutes. The angle is wrapped modulo 2π, so the wrap is
invisible. Set the value to `0` to freeze the sky, or use a positive value to
pan the stars the other way. Visitors with `prefers-reduced-motion: reduce` get
a fixed sky.

The shipped asset is `assets/rogland_clear_night_4k.webp` (4096×2048, 2.96 MiB),
converted from an 8192×4096 source that stays out of git. It is contrast- and
saturation-boosted for the small window area. The glass uses a faint cool tint
(`0xa8c0d0`) at `opacity: 0.06`, with no metalness, roughness `1` and no
environment reflection, so it does not add a white shine over the stars.

To use a different sky, keep a 2:1 equirectangular image, add it under
`assets/`, and point `windowViewUrl` at it.

---

## How the TV is embedded

The existing `#tv-screen` element is not replaced. It is wrapped in a CSS3D
object and positioned on the screen mesh, so the real DOM — YouTube iframe, OSD,
static canvas, power/CRT effects — keeps working inside the 3D TV.

The iframe is rendered in a centred 5:4 viewport and overscanned to 160% width
to hide YouTube chrome inside the 4:3 glass. Because CSS3D is a separate layer,
it always draws on top of the WebGL room. The screen sits inside the bezel, so
this reads correctly; if you replace the model with geometry that must occlude
the TV, that needs a different compositing approach.

---

## Failure behaviour

- No WebGL, no model, fetch error, or parse error: the hidden DOM room becomes
  visible as a static fallback. Reload to retry 3D.
- WebGL context loss stops the render loop; reload to rebuild the 3D room.
- Power-off / power-on does not reload the page or re-parse the model.
- A power press during loading is queued and applied inside the 3D room once it
  is ready.

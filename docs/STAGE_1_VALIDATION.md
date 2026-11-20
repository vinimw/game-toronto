# Stage 1 — Prototype stabilization

## Scope

Keep the existing Three.js demo, visual treatment and memory. No OSM importer changes,
new gameplay, regional streaming or additional dependencies. Work is on
`codex/stabilize-gameplay`; delivery is a local commit only.

## Changes

- `src/movement.js`: camera-relative movement; finite coordinate guards; 0.35 m body
  radius against existing building/water polygons and world bounds; collision substeps
  and axis sliding; actual displacement speed and heading; shared building heights;
  camera volume sweep against building footprints/heights; independent simulation
  and real frame timing.
- `src/controls.js`: independent pointer ownership for camera, joystick and run;
  cancellation/capture-loss handling; reset on overlays, blur and visibility changes;
  bounded pitch and zoom; mouse sensitivity kept configurable.
- `src/main.js`: integrates movement, executed-speed animation and camera collision;
  rejects invalid/blocked spawn before applying coordinates; exponential follow and
  orbit smoothing; displays real average FPS and milliseconds per frame.
- `src/world.js`: exposes the body collision test and building camera volumes using
  the same heights as rendered geometry.
- `src/styles.css`: safe-area insets, overscroll prevention and gesture containment.
  Modal content retains vertical touch scrolling.
- `tests/*.test.js`: Node built-in test runner; no test dependency added.
- `package.json`: `npm test` runs JavaScript and existing Python importer tests.

Camera tuning is in `cameraSettings` in `src/main.js`: distance/pitch bounds, yaw and
pitch sensitivity, follow and orbit rates. Body radius is `PLAYER_RADIUS` in
`src/movement.js`; the camera uses a 0.22 m clearance and 0.10 m sweep steps.

## Executed validation

Environment: Node v24.14.0, npm 11.9.0. No physical phone attached.

| Check | Result |
| --- | --- |
| `npm test` | 22 JavaScript tests and 3 existing Python tests passed |
| `npm run build` | Passed; JS 587.37 kB / 152.20 kB gzip |
| Automated movement | Four directions, yaw, diagonal normalization, analog magnitude, invalid values, idle/blocked animation speed and heading |
| Automated collision | Radius at edges/corners, water, bounds, thin walls, sliding and camera sweep including building heights |
| Automated controls | Independent simulated pointer IDs, simultaneous joystick/camera, unrelated pointers, cancellation/capture loss, reset and pitch/zoom bounds |
| Actual demo integration | Built Three.js scene; simulated route to existing memory; cafe collision/camera obstruction; finite geometry attributes and world matrices |
| Browser initialization | Demo rendered; no warning/error console entries during inspected runs |
| Browser gameplay | WASD directions, Shift running, mouse orbit and third-person follow executed; coordinate HUD remained finite |
| Existing memory | Walked from spawn to marker, pressed E, observed unlock 1/1 and memory dialog, closed and opened album; unlock survived subsequent reload |
| Narrow layout | 390 × 844 viewport; joystick dragged with a mouse and position changed; controls remained visible |
| `npm audit --omit=dev` | 0 reported vulnerabilities |

The browser HUD showed real intervals around 100 ms / 10 FPS during background
browser testing. This is an observation of that execution environment, not a mobile
performance benchmark. Simulation delta stays capped at 50 ms, so sustained slow
frames intentionally slow simulation rather than causing large jumps. FPS/frame
time uses uncapped intervals; the display is an average over at least 450 ms.

### Limits of verification

- No physical iPhone/Safari or Android/Chrome test was performed. Notch/gesture-bar
  clearance, OS gesture handling, thermal stability, input latency and mobile FPS
  remain unverified on hardware.
- Multi-pointer behavior was executed with synthetic events in automated tests;
  it was not exercised with two physical fingers. The narrow browser joystick
  check used mouse input, not native touch.
- Body/camera obstacle scenarios were executed in automated geometry and actual
  demo-scene tests. A full manual traversal of every obstacle was not performed.
- No real OSM snapshot was imported or geographically validated in this stage.
- Collision is intentionally simple and covers existing building/water obstacles;
  procedural trees remain decorative. No terrain physics, bridge/tunnel semantics
  or navigation mesh was added. A blocked/invalid imported spawn fails explicitly.
- The build still reports its existing >500 kB chunk warning. No bundle splitting
  or other premature optimization was introduced.

## Dependency audit

`npm audit fix` was run without `--force`. It made no compatible dependency changes.
The four high-severity entries are one root advisory propagated through development
packages, not four separate root vulnerabilities:

```text
vite@7.3.8
├─ picomatch@4.0.7
├─ fdir@6.5.0 → picomatch@4.0.7
└─ tinyglobby@0.2.17 → fdir / picomatch
```

Advisory: [GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf),
ReDoS when processing crafted repeated extglob patterns. At the time of this check,
`npm view picomatch version` returned 4.0.7 and the advisory listed no patched version.
The audit suggested Vite 6.2.7 through `--force`, an incompatible downgrade that was
not applied. No arbitrary override or advisory suppression was added. The four
high entries therefore remain in the development dependency graph; the production
only audit reports zero. Recheck the advisory before the next dependency update.

## Run and reproduce

```bash
npm ci
npm test
npm run build
npm run dev
```

Open the Vite URL. With no OSM snapshot, the explicitly labeled illustrative demo
is expected. Test WASD/arrows, diagonals, Shift, mouse drag, wheel zoom and pitch
limits. Approach cafe walls and water from the front and diagonally; verify body
clearance, sliding and camera retraction. Standing against a wall should stop the
walking animation. Opening the map/album and switching focus should clear inputs.

For the existing demo memory, rotate the camera to face north (N), then travel
approximately 42 m east and 40 m south from spawn; press E when prompted. Open the
album and reload to confirm persistence. This route also runs automatically against
the actual scene geometry in `tests/world.test.js`.

For hardware acceptance, use `npm run dev` on a trusted local Wi-Fi network and open
`http://<computer-LAN-IP>:5173` in Safari/iPhone and Chrome/Android. Test joystick
with one finger, camera with another and run with a third; release/cancel each in
varying order, background/restore the page, rotate the phone and check HUD clearance
in portrait/landscape. Record models, OS/browser, FPS/ms and a sustained session.
This hardware checklist is pending, not a claim of completed validation.

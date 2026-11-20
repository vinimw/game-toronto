# Region scenes

## Scope and entry point

Implementation workspace: `/Users/viniciusweber/Documents/ChatGPT/game-toronto`.
The separate original `jobs/game-love-high-park` directory is not synchronized.
The app starts in a small **illustrative Toronto** scene. Walk toward the wooden
portal and press E or tap the action button to enter High Park. At the park
entrance the action changes to **Voltar a Toronto**. Transitions are interaction
based; walking through the arch alone does not load another scene.

No expanded Toronto geography, new mission, new memory, dependency or OSM importer
change was introduced. High Park keeps the existing demo/map loader, memory,
character, camera and controls.

## Architecture

- `src/regions.js`: configurable region manifest; stable region/portal IDs,
  geographic origin references, entries, activation radii and destination links.
- `src/scenes/load-region.js`: lazy loader registry. Toronto and High Park data
  are created on demand; no scene instances are cached.
- `src/scenes/toronto.js`: small illustrative entry area. Procedural forest is
  disabled here so vegetation cannot engulf the camera in this small urban scene.
- `src/scene-manager.js`: validates entries, loads data, disposes the old scene,
  builds/activates the destination, reparents the existing avatar and handles
  transitions. At most one built region exists at a time. Overlapping requests
  are rejected while loading.
- `src/scene-resources.js`: collects unique geometries, materials, material and
  uniform textures, scene background/environment textures and InstancedMesh
  resources. Disposes exclusive resources once and clears scene children.
  Avatar resources and explicitly registered `sharedResources` are retained.
- `src/game-state.js`: scene-independent inventory, unlocked memory IDs and
  progress; persistent storage with migration from the original memory key.
  No new inventory item or gameplay system was added. Storage failure retains
  in-session state. A reload without working storage cannot retain progress.
- `src/main.js`: one renderer, camera, avatar and set of control listeners.
  Region changes update scene references, map, title, location and action labels;
  they do not recreate the character or attach additional input listeners.

### Transition lifecycle

1. Set the synchronous loading lock; reset held inputs, close overlays and save
   progress. Show a 220 ms fade to an opaque overlay.
2. Fetch/prepare destination data and validate entry and exit positions. The old
   scene remains available if loading or validation fails.
3. Detach the shared avatar; dispose and clear the old scene.
4. Build exactly one destination scene; attach the same avatar and project its
   geographic arrival into the destination's local meter coordinates.
5. Reset camera follow at the arrival, update the HUD, fade in and unlock input.
   Held E repeats and double taps cannot start concurrent transitions.

If construction fails, partial resources are disposed and the previous region is
rebuilt at the previous player position and heading. If loading/validation fails,
the previous instance is preserved. The transition lock is released in a finally
block. The reduced-motion preference removes the fade duration.

### Geographic contract

Coordinates in the manifest use `{lat, lon}`. Every region world declares its
origin; the existing `latLonToLocal` projects entry/exit points relative to that
origin. Local coordinates are never copied between scenes. Tests cover worlds
with different origins and verify the inverse geographic coordinate on arrival.

The first linked anchor is **43.6508, -79.4651**. It is a prototype transition
reference, **not a surveyed or verified physical park gate**. Both directions
refer to the same geographic anchor. The High Park demo has arbitrary illustrative
geometry; only its geographic origin metadata is anchored to this reference, so
its existing local spawn, paths, buildings and memory remain unchanged.

When a real OSM snapshot exists, its original origin and coordinates are preserved.
The configured geographic entry must lie within its bbox and outside water and
building collision volumes. Invalid/obstructed entries abort the transition rather
than silently teleporting to an unrelated location. Validate/reconfigure these
anchors against a real snapshot before describing them as real-world entrances.
No real snapshot was imported or geographically verified in this delivery.

### Extending the manifest

For a future cafe, subway or supermarket, add a stable region definition with an
entry and a reverse portal, choose explicit geographic anchors/origin, implement
its lazy data loader and register that loader in `load-region.js`. The loader
returns world data; `buildWorld` builds the scene. If a location needs different
scene construction, route `buildScene` by world/region metadata. Register any
shared GPU resources explicitly with the manager before reusing them across scene
lifetimes. Do not cache built scenes or attach per-region global input listeners.

## Executed validation

`npm test`: **33 JavaScript tests and 3 Python importer tests passed**.
`npm run build`: passed; lazy Toronto and map-loader chunks were produced. The
existing >500 kB main chunk warning remains (591.79 kB / 153.73 kB gzip).
`git diff --check`: passed.

Automated coverage includes 20 round trips with actual Three.js scene generation,
resource disposal events and bounded live-resource counts; preserved avatar
identity; geographic arrivals with different origins; independent progress and
storage migration; duplicate transitions; unknown/duplicate IDs; invalid/blocked
entries; data-fetch errors; partial scene construction cleanup and rollback.
Previous movement, collision, pointer ownership and demo memory route tests also
continue to pass.

Browser checks were run at `http://localhost:5175/`:

- Walked to the Toronto entrance and entered/exited using E; tested the action
  button for returning to Toronto.
- Executed 10 round trips after the final visual adjustment, with 20 resource
  samples. Results stayed identical for each region:

  | Active region | WebGL geometries | WebGL textures | Direct scene children | Avatars |
  | --- | ---: | ---: | ---: | ---: |
  | Toronto | 20 | 1 | 10 | 1 |
  | High Park | 29 | 1 | 28 | 1 |

- Returned to the geographic gate position (local 0,0 in these illustrative
  worlds), without duplicating the character or losing the existing unlocked
  memory (album remained 1/1).
- Opened the map in both regions and the unlocked album in Toronto.
- Sent W while loading was true; arrival remained at 0,0. Also observed startup
  input ignored until the fade completed.
- Inspected console logs: no warning/error entries during these runs.
- Checked that the portal and avatar remain visible in both scenes. Toronto's
  overly dense default procedural forest was removed during visual QA.

WebGL counts are sampled in development only through the canvas `data-resources`
attribute, using `renderer.info.memory`. The renderer may retain internal resources
(the single texture in this run); the criterion is a stable baseline per scene,
not a zero total. Tests also ensure shared textures survive and exclusive textures
are disposed even when referenced through nested shader uniforms.

### Limitations

These checks establish stable tracked geometry/texture counts and disposal, not a
proof of flat total browser/OS memory. Long-duration JavaScript heap profiling and
thermal/mobile performance measurements were not performed. No physical iPhone or
Android was tested; multi-pointer behavior remains covered by synthetic automated
control tests, not a two-finger hardware session. Region geometry is illustrative,
flat and limited; no tile streaming, city-wide map or interior physics was added.
The previously documented four high development-dependency audit entries were not
changed by this dependency-free implementation.

## Reproduce

```bash
cd /Users/viniciusweber/Documents/ChatGPT/game-toronto
npm ci
npm test
npm run build
npm run dev -- --port 5175 --strictPort
```

Open `http://localhost:5175/`. Use the URL printed by Vite on a phone on the same
network. The explicit port avoids the unrelated project already using port 5173.
Walk forward from the initial spawn until **Entrar no High Park** appears. Press E
or tap. Enter/exit repeatedly, move away and back to the gate, open M/map and
I/album, and revisit the existing memory. Hold movement during a transition and
confirm it remains blocked. For hardware acceptance, test joystick, camera and run
with separate fingers, capture cancellation, background/restore and portrait/
landscape. These physical checks remain pending.

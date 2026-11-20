---
name: blender-game-asset-pipeline
description: Build and validate authored PBR and GLB scenery for Game Love.
---
1. Read `docs/art/asset-licenses.md`. Record source, author, license and transformations for every input.
2. Generate cards with `python3 tools/art/build_leaf_cards.py /tmp/game-love-leaves` (Pillow), then export with `blender --background --factory-startup --python-exit-code 1 --python tools/art/build_north_entrance.py -- public/assets/north-entrance /tmp/game-love-leaves`.
3. Work in metres, export +Y up, anchor roots at the ground and keep LOD footprints consistent. Preview alpha masks and material slots in game.
4. Run `npm test`, `npm run build` and the visual export. Measure file sizes and GPU texture costs before introducing a codec.

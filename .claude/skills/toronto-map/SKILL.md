---
name: toronto-map
summary: Generate geographically sourced, stylized map regions for Game Love
---
# Toronto map workflow

1. Collect authoritative geometry from OpenStreetMap or Toronto Open Data, with attribution and license metadata.
2. Write the raw import to `tools/` and normalized output to `public/data/`. Import should be reproducible.
3. Use local meter coordinates (x=east, z=south) relative to a documented origin. Avoid using latitude/longitude directly as mesh coordinates.
4. Keep visual stylization separate: roads, building volumes, water and paths should stay spatially faithful; textures, tree art and colors may be procedural.
5. Document omitted features, geometry precision and bbox, and verify recognizable landmarks against a reference map.
6. Start with one small region; do not load all of Toronto into one scene.
7. Do not reuse Google Maps tiles, Street View photos or 3D assets as game meshes.

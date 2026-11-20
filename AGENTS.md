# Game Love · Development Rules

- Purpose: emotionally grounded exploration game in third person; real Toronto geography + stylized art.
- Preserve separation between geographic data (`tools/`, `src/map-loader.js`) and visual representation (`src/world.js`).
- Never label fabricated demo geometry as a faithful map of Toronto.
- Never scrape Google Maps data, imagery or 3D models.
- Source geography from OSM (ODbL attribution) or verified compatible Toronto Open Data.
- Preserve mobile controls and mobile performance when adding features.
- Memories must be data driven and fictional until user content is provided; avoid committing private photos to public repositories.
- Prefer conventional commits and small feature branches. Avoid adding arbitrary npm dependencies.
- When adding new regions, keep geographic coordinates out of runtime mesh calculation when possible; convert to a local projected coordinate space during import.
- For every large rendering change, measure FPS on a real mobile device before expanding the map.
- Preserve reference-grounded visual fidelity in high-priority areas. Compare matched desktop and mobile views against the documented site reference before accepting changes to architecture, foliage, materials or lighting.

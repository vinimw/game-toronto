---
name: threejs-graphics-optimization
description: Profile GLB, instancing, texture, shadow and LOD costs for Game Love on WebGL.
---
1. Keep the binary cache separate from GPU ownership. Attach live meshes and materials to SceneManager and discard failed load promises.
2. Instance repeated parts, alpha-mask foliage and bound shadows. Inspect transitions between High, Balanced and Low.
3. Run `npm run review:export -- --baseline <zip>` at matched poses and viewports. Compare draw calls, triangles, texture memory estimates, load time and p95.
4. Before widening coverage, profile the route on physical Safari iOS and Chrome Android. Treat viewport and touch emulation as regression checks.

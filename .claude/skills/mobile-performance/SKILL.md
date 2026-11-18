---
name: mobile-performance
summary: Preserve mobile usability and budget when developing Game Love
---
# Mobile performance workflow

1. Measure FPS, draw calls, triangles, heap use and input latency before/after significant changes.
2. Prefer InstancedMesh for repeated vegetation and props. Use geometry batching and LOD for expansions.
3. Keep pixel ratio limited on phones; preserve joystick and camera touch interaction.
4. Render only nearby tiles when Toronto expands beyond the proof-of-concept bbox.
5. Test on Safari iOS and Chrome Android rather than treating desktop emulation as proof.
6. Ensure UI buttons stay accessible above mobile safe areas and do not overlap the joystick.

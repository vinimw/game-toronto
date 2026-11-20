# Development speed control

The floating speed panel adjusts the persistent PlayerController, shared by all
regions, from 1× through 5× in 0.5× steps. Normal walk/run speeds remain 5.1/9
units per simulation second; at 5× they are 25.5/45. The panel displays both
configured speeds and the executed movement speed (zero while idle or blocked).

Use the slider, +/− buttons, Normal (1×), or the keyboard +/−. The = key also
increases speed, allowing keyboards where + requires Shift. Browser zoom shortcuts
with Ctrl/Command/Alt and native slider navigation are preserved. WASD still works
when panel buttons or the slider have focus. The panel starts minimized on narrow
or short viewports, and can be expanded with its labeled header button.

The multiplier is not in game-state or localStorage: it survives region changes
within a session, but every page reload/new opening starts at 1×. Environmental
clocks and the simulation delta are unchanged. Animation uses executed movement
speed divided by the multiplier, preserving normal walking/running cadence and
stopping when blocked. No transport timing or scene/map geometry was modified.

Collision steps remain at most half the body radius (0.175 units) regardless of
speed. The guarded maximum displacement now allows 2.25 units per capped 50 ms
frame, enough for running at 5×, while still rejecting non-finite/unbounded values.
This requires at most 13 substeps. The existing simulation delta cap still applies
under slow frames; the setting does not change the world's time scale.

## Executed checks

- `npm test`: 41 JavaScript tests + 3 existing Python importer tests passed.
- `npm run build`: passed; existing main chunk warning above 500 kB remains.
- Automated checks: 1×/2×/3×/5× walk/run, diagonal normalization inherited from
  movement tests, normal animation cadence/heading, clamping/half steps, reset,
  finite positions, thin building/water obstacles and map bounds at 5×, keyboard
  modifiers, slider/buttons/output/minimization, fresh controller default.
- Browser: changed speed by buttons and keyboard; moved in Toronto at 2×/3× and
  High Park at 5×; returned to Toronto with the multiplier preserved; reset with
  Normal; operated the native slider with ArrowRight/End; minimized/expanded;
  reloaded from 5× and observed 1×. No warning/error console entries were observed.
- Responsive check at 390 × 844; physical iOS/Android touch and sustained mobile
  performance were not tested. High-speed collisions were verified in automated
  geometry tests, not by manually traversing every obstacle on both maps.

Run in the current workspace with `npm test`, `npm run build` and
`npm run dev -- --port 5175 --strictPort`; open http://localhost:5175/.

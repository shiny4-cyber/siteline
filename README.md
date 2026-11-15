# SITELINE

[![make.fun three.js FPS bounty](https://make.fun/badge/threejs-fps-02.svg)](https://make.fun/bounty/threejs-fps-02)
[![rank](https://make.fun/badge/threejs-fps-02/shiny4-cyber/siteline/rank.svg)](https://make.fun/bounty/threejs-fps-02)
[![reward](https://make.fun/badge/threejs-fps-02/shiny4-cyber/siteline/reward.svg)](https://make.fun/bounty/threejs-fps-02)

A round-based tactical FPS in three.js 0.187.0, played in the browser against seven bots.
Two lanes, one relay hall, a charge to plant and a clock that does not wait.

Attackers plant a charge at SITE A; defenders hold the doors, defuse, or run the round out.
Rounds end by detonation, defuse, elimination or timeout, then restart with the money you earned.

## Run

```sh
node serve.mjs          # prints http://127.0.0.1:<port>/ — open it in a desktop browser
```

No build step, no network at runtime, no installed dependencies: the page is plain ES modules and
the vendored three.js module. Controls are on the start card and in `game/DESIGN.json`.

## Test

```sh
node tests/logic.mjs            # headless simulation tests (no browser)
python3 tests/browser.py        # real Firefox: gameplay assertions + the three screenshots
```

`tests/browser.py` needs Playwright with Firefox and Pillow. On this host headless Firefox does not
composite WebGL into screenshots, so it launches Firefox headed on the running X display; the game
is driven through the debug hooks in `game/main.js` and the static server runs on an ephemeral port.
The script writes `tests/browser-report.json` and `screenshots/1..3`.

## Build the entry

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts     # copies game/ + screenshots/, writes dossier.json
```

`main.ts` uses the kit's unmodified `vendor/makefun-threejs.ts` `buildDossier` with the bounty's caps
(160 KiB of source text, 4 screenshots at most, 256 KiB each). The program is deterministic: two runs
write identical bytes.

## Layout

```
game/index.html      import map for three 0.187.0, HUD markup and styling
game/main.js         renderer, input, 120 Hz accumulator, debug hooks
game/sim.js          fixed-step phase clock, plant/defuse, grenades, win conditions
game/movement.js     acceleration, crouch, jump, collision
game/combat.js       weapons, hit traces, damage, noise events
game/bots.js         perception, A* routes, hold/investigate/cover, stuck re-path
game/nav.js          nav-graph build and A*
game/map.js          layout, collision solids, ray tests
game/world.js        scene, procedural textures, signage, viewmodel
game/hud.js          HUD, buy menu, kill feed
game/state.js        one state object, constants, round lifecycle
game/DESIGN.json     controls and systems, written for the judge
tests/logic.mjs      collision, nav, combat, objective, round restart
tests/browser.py     live browser assertions and screenshot capture
```

## Honest limitations

- Single-player only: the seven bots are driven by the same simulation, with no networking.
- Bot aim is a hitscan trace with a reaction delay; it does not model projectile travel or suppression.
- Defenders defuse on a fixed 5 s timer once they reach the charge; they do not clear the site first.
- No audio. Feedback is visual: muzzle flash, tracers, hit marker, kill feed.
- Grenades bounce on the ground plane only; they do not bounce off walls.
- Screenshots are 1280x800 JPEG (the rules cap the long side at 1280 and the short side at 480).
- `vision_analyze` was unavailable in the build environment (provider returned 403), so screenshots
  were verified with pixel statistics, in-page projection checks and DOM/HUD assertions rather than a
  model's visual read.

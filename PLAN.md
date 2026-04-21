## Overview
Build a browser-only Space Invaders MVP on a single `index.html` page using Vite, TypeScript, Canvas 2D, keyboard input, and synthesized WebAudio SFX. The implementation centers on a deterministic `step(state, dt, input) => state` simulation that drives a playable loop with a player ship, a 5x11 invader grid, player projectiles, collisions, score, lives, pause, wave-clear, and game-over states, with the full simulation covered by at least 20 Vitest cases.

## Architecture
- `src/main.ts` owns bootstrap and the fixed-timestep loop. It creates the initial `GameState`, polls the keyboard adapter each frame, advances the simulation at 60 Hz, renders the latest state, lazily initializes or resumes audio on the first user gesture, and derives audio triggers by comparing the previous and next states.
- `src/game/state.ts` defines the core types, constants, and initial-state factory for the playfield, player, invaders, projectiles, score, lives, and phase flags, including the short post-hit `lifeLost` transition state.
- `src/game/step.ts` is the pure simulation boundary. It applies input, movement, cooldowns, invader marching and descent, collision resolution, score/life updates, life-loss freeze timing, pause handling, wave-clear, and game-over transitions without touching DOM, audio, or timers outside the state object.
- `src/input/keyboard.ts` converts browser key events into a typed per-frame `Input` snapshot with edge-triggered actions for fire and pause. `firePressed` doubles as the start/continue/restart action when the phase is not `playing`, so the plan stays within the constitution's MVP key set.
- `src/render/canvas.ts` draws the entire play surface from `GameState` only: background, player, invaders, bullets, HUD, and overlay states. It should render at device-pixel-ratio scale so geometric graphics stay sharp on hi-res displays.
- `src/audio/sfx.ts` exposes a tiny sound facade backed by `AudioContext`, oscillator nodes, and gain envelopes. Audio remains optional at runtime: if the context cannot start after a user gesture, gameplay continues silently with a visible mute indicator.
- Data flow: `KeyboardEvent` listeners update key state -> `main.ts` snapshots input -> fixed 60 Hz `step()` updates `GameState` -> `canvas.ts` renders the state -> `main.ts` compares state transitions and asks `sfx.ts` to play `shoot`, `hit`, `playerDeath`, or `waveClear`.

## User experience
Primary layout component: `GameShell`
Children: `HudBar`, `CanvasStage`, `OverlayPanel`, `ControlHints`

Screen list

1. Start screen
Route: `/`
Purpose: introduce the game, controls, and the "press to begin" action before the first wave starts.
Primary action: `Space` starts a new run.

Wireframe:
```text
+------------------------------------------------------+
| SCORE 0000  WAVE 1                      LIVES 3      |
|------------------------------------------------------|
|                                                      |
|                 SPACE INVADERS MVP                   |
|            Arrow keys move  Space fires             |
|                  P pauses the game                  |
|                                                      |
|                 [ Press Space to Start ]            |
|                                                      |
|                  (canvas playfield)                 |
|                                                      |
+------------------------------------------------------+
```
Empty / error / loading:
- Empty: this is the default empty state before a run exists.
- Loading: a short bootstrap label such as `Initializing canvas...` appears inside the overlay until the first frame is ready. Audio is armed only after the first `Space` press.
- Error: if Canvas 2D is unavailable, replace the canvas area with a blocking message that the browser is unsupported; if audio setup fails after the first gesture, show a non-blocking `Sound unavailable` note and continue.

2. Playing screen
Route: `/`
Purpose: active gameplay loop with movement, shooting, collision feedback, score, lives, and advancing invader formation.
Primary action: move with arrow keys and fire with `Space`.

Wireframe:
```text
+------------------------------------------------------+
| SCORE 0120  WAVE 1                      LIVES 2      |
|------------------------------------------------------|
|   V V V V V V V V V V V                              |
|   V V V V V V V V V V V                              |
|   V V V V V V V V V V V                              |
|   V V V V V V V V V V V                              |
|   V V V V V V V V V V V                              |
|                           |                          |
|                          shot                        |
|                                                      |
|                     /_\ player                       |
+------------------------------------------------------+
```
Empty / error / loading:
- Empty: not applicable; the playfield is always backed by an initialized in-memory `GameState`.
- Loading: none after bootstrap because the game uses no remote data and no asset fetches.
- Error: if audio is unavailable mid-session, show a small muted indicator only; gameplay and rendering continue.
- Life-loss behavior: if the invader formation reaches the player collision/fail line, `step()` switches to a dedicated `lifeLost` phase and uses `GameState.transitionTimerMs` to freeze movement, firing, and pause input for a short fixed delay. When the timer expires, the current wave resets to its starting formation while preserving score and remaining lives; if no lives remain, it transitions to game over instead.

3. Paused overlay
Route: `/`
Purpose: freeze simulation without losing progress.
Primary action: `P` resumes play.

Layout: the current playfield remains visible and dimmed, with a centered overlay showing `Paused`, the control reminder, and `Press P to Resume`.
Empty / error / loading:
- Empty: not applicable; pause only exists on top of an active game state.
- Loading: none.
- Error: same non-blocking audio warning behavior as the playing screen.

4. Wave clear overlay
Route: `/`
Purpose: confirm the player cleared all invaders, surface the updated score, and gate the next wave.
Primary action: `Space` begins the next wave.

Layout: the HUD remains visible while a centered overlay announces `Wave Clear`, shows the current score and remaining lives, and prompts `Press Space for Next Wave`.
Empty / error / loading:
- Empty: not applicable; this state only appears after the last invader is removed.
- Loading: none.
- Error: no additional error surface beyond the shared audio warning.

5. Game over overlay
Route: `/`
Purpose: end the run when lives reach zero or invaders reach the fail condition, and offer a clear restart action.
Primary action: `Space` starts a fresh run from wave 1.

Layout: the final playfield freezes under a centered `Game Over` card that displays final score, wave reached, and `Press Space to Restart`.
Empty / error / loading:
- Empty: not applicable; the overlay always has a completed run to summarize.
- Loading: none.
- Error: no additional error surface beyond the shared audio warning.

Screen flow
- `/` Start -> Playing
- `/` Playing <-> Paused
- `/` Playing -> Wave clear -> Playing (next wave)
- `/` Playing -> Game over -> Start-equivalent restart on `Space`

UX notes
- This is a single-route app; screen changes are game-state overlays inside the same canvas shell rather than navigation events.
- The HUD is consistent across start, play, pause, wave-clear, and game-over states: it always shows score, wave, and lives, with the start screen rendering the pre-run `WAVE 1` state.
- No remote fetches exist in MVP. "Loading" means local bootstrap only; "error" means browser capability degradation, not server failure.
- Styling stays minimal and inline per the constitution. The canvas carries most of the presentation, with the shell limited to centering, background, and text legibility.

## File tree
Files to create or modify for the MVP implementation:

```text
package.json
pnpm-lock.yaml
tsconfig.json
eslint.config.js
vitest.config.ts
index.html
src/
  main.ts
  game/
    state.ts
    step.ts
    step.test.ts
  input/
    keyboard.ts
  render/
    canvas.ts
  audio/
    sfx.ts
```

## Dependencies
- Runtime dependencies: none. MVP should ship with only browser APIs (`CanvasRenderingContext2D`, `requestAnimationFrame`, `KeyboardEvent`, `AudioContext`).
- Dev dependencies: `typescript`, `vite`, `vitest`, `eslint`, `@eslint/js`, `typescript-eslint`.
- Package manager and commands must match the constitution exactly: `pnpm install --frozen-lockfile`, `pnpm vitest run`, `pnpm eslint .`, `pnpm tsc --noEmit`, `pnpm build`.
- `tsconfig.json` must explicitly enable both `strict: true` and `noUncheckedIndexedAccess: true`; code in `step.ts` should assume indexed array reads may be `undefined`.
- `package.json` must define a `build` script that maps to `vite build` so `pnpm build` succeeds as written in the constitution.
- Explicit non-dependencies: React, game engines, animation libraries, CSS frameworks, external sprite/audio assets.

## Data model
Core types expected for the MVP:

```ts
type GamePhase = "start" | "playing" | "lifeLost" | "paused" | "waveClear" | "gameOver";

type Input = {
  moveX: -1 | 0 | 1;
  firePressed: boolean;
  pausePressed: boolean;
};

type Arena = {
  width: number;
  height: number;
  floorY: number;
};

type Player = {
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  shootCooldownMs: number;
};

type Invader = {
  id: number;
  row: number;
  col: number;
  x: number;
  y: number;
  width: number;
  height: number;
  points: number;
};

type Projectile = {
  id: number;
  owner: "player";
  x: number;
  y: number;
  width: number;
  height: number;
  velocityY: number;
  active: boolean;
};

type Formation = {
  direction: -1 | 1;
  speed: number;
  descendStep: number;
  leftBound: number;
  rightBound: number;
};

type HudState = {
  score: number;
  lives: number;
  wave: number;
};

type GameState = {
  phase: GamePhase;
  arena: Arena;
  player: Player;
  invaders: Invader[];
  projectiles: Projectile[];
  formation: Formation;
  hud: HudState;
  frame: number;
  transitionTimerMs: number;
};
```

Modeling notes
- Keep the simulation deterministic by storing all gameplay-affecting timers and counters inside `GameState`.
- Use a flat `invaders: Invader[]` list with `row` and `col` metadata rather than a nested matrix. The array contains only living invaders: on hit, the struck invader is removed from the array, `invaders.length` drives the speed-up rule, and wave clear triggers when `invaders.length === 0`.
- Limit MVP projectiles to player shots unless the roadmap is revised; enemy bullets are not required by the constitution.
- `GameState.transitionTimerMs` gates the short `lifeLost` freeze. While `phase === "lifeLost"`, `step()` decrements that timer and ignores move, fire, and pause input until the reset or game-over transition completes.
- Because `noUncheckedIndexedAccess` is enabled, any direct indexed access into `invaders` or `projectiles` must guard `undefined`; prefer iteration patterns that minimize unchecked indexing.
- Audio triggers should be derived from state transitions in `main.ts` rather than returned from `step()`, preserving the required `step(state, dt, input) => state` boundary.

## Implementation phases
1. Scaffold the toolchain and page shell.
   Add `package.json`, `tsconfig.json`, `eslint.config.js`, `vitest.config.ts`, and `index.html` so the repo can lint, typecheck, test, build, and mount a single canvas entrypoint with minimal inline CSS. `tsconfig.json` must set `strict: true` and `noUncheckedIndexedAccess: true`, `package.json` must include a `build` script for `vite build`, and the lint setup should treat warnings as release blockers.

2. Define the simulation model.
   Implement `src/game/state.ts` with the typed arena, player, invader, projectile, HUD, and phase models, plus constants and an initial-state factory for the 5x11 formation and starting lives/score. Model a dedicated `lifeLost` phase with `transitionTimerMs`, and keep `invaders[]` as the live invader set rather than mixing live/dead entries.

3. Implement the pure `step()` loop.
   Add movement clamping, shooting cooldown, projectile advancement and cleanup, invader marching and descending, bullet-vs-invader collision, invader reach/player collision handling, score updates, life loss with the `lifeLost` freeze and current-wave reset, pause toggling, wave clear, and game-over transitions. Outside `playing`, reuse `firePressed` for start/continue/restart so no extra confirmation key is required.

4. Lock down the simulation with tests.
   Write `src/game/step.test.ts` with at least 20 cases covering input handling, no-op frames, movement bounds, fire gating, projectile cleanup, collision scoring, invader reversal and descent, invader speed-up as counts shrink, pause behavior, wave clear, and game over.

5. Add the input adapter and renderer.
   Implement `src/input/keyboard.ts` for stable frame snapshots and `src/render/canvas.ts` for drawing the playfield, HUD, and overlay states with procedural geometry sized against the logical arena. Keep the HUD consistent across all states by always rendering score, wave, and lives.

6. Wire audio and the runtime loop.
   Finish `src/main.ts` with the `requestAnimationFrame` accumulator, fixed 60 Hz stepping, render calls, start/restart flow, and transition-based SFX playback through `src/audio/sfx.ts`. Create or resume the `AudioContext` only from the first user gesture that leaves an overlay, with graceful mute fallback if audio still cannot start.

7. Verify, tune, and document behavior.
   Run the constitution commands, tune gameplay constants for an actually playable loop, and do a manual browser pass to confirm movement, shooting, collisions, overlays, and sound cues feel coherent.

## Acceptance criteria
- `pnpm install --frozen-lockfile`, `pnpm vitest run`, and `pnpm build` all succeed; `pnpm eslint .` passes with zero warnings; and `pnpm tsc --noEmit` passes with `strict: true` and `noUncheckedIndexedAccess: true`.
- Opening the built or previewed app shows a single centered canvas game shell on route `/`.
- The start overlay explains controls, shows the same score/wave/lives HUD used in gameplay, and `Space` starts a new run.
- Left and right arrow keys move the player ship and clamp it within the playfield bounds.
- Pressing `Space` fires player shots with a cooldown during play; outside `playing`, the same key starts, continues, or restarts the run. Shots travel upward and are removed when they leave the arena or hit an invader.
- A 5x11 invader formation marches horizontally, descends when it hits an edge, and speeds up as `invaders.length` shrinks.
- Player shots destroy invaders, increase score, and trigger a hit SFX.
- If the invader formation reaches the player collision/fail line, the run enters a short `lifeLost` freeze gated by `transitionTimerMs`, plays the player-death SFX, ignores gameplay input during the freeze, and then resets the current wave to its initial 5x11 layout while preserving score; if lives reach zero, the game transitions to the game-over overlay.
- Clearing all invaders shows a wave-clear overlay and allows the player to continue to the next wave with `Space`.
- Losing the final life shows a game-over overlay with final score and a `Space` restart prompt.
- Pressing `P` pauses and resumes without advancing the simulation while paused.
- Audio setup is attempted only from a user gesture; if the browser still rejects or lacks audio, gameplay remains playable and the UI shows a non-blocking mute indicator.
- The renderer uses only Canvas 2D geometry and text, with no external sprite or audio files.
- The test suite contains at least 20 assertions/cases focused on the pure simulation, not DOM rendering.

## Open questions
- The constitution asks for "modern hi-res graphics" but the MVP also restricts rendering to pure geometry and minimal shell styling. Exact art direction, palette, and typography are not specified; execution should choose a simple geometric arcade look unless product direction is provided.
- The exact logical canvas size and aspect ratio are unspecified. Execution should select a stable arcade playfield that scales cleanly with `devicePixelRatio`, but a concrete target resolution still needs confirmation.
- `CONSTITUTION.md` mentions `localStorage` high-score persistence in Boundaries and Hardening, but not in the MVP roadmap. This plan excludes high score from MVP unless it is explicitly promoted.
- The MVP scope does not mention invader-fired projectiles. This plan assumes player-only bullets and treats invader reach/contact as the life-loss fail condition unless requirements expand.

## Revision notes for round 1
- Addressed the repeated TypeScript feedback by explicitly requiring `strict: true` and `noUncheckedIndexedAccess: true` in Dependencies, Implementation phases, Modeling notes, and Acceptance criteria.
- Reconciled the life-loss contradiction by adding an explicit `lifeLost` phase, using `GameState.transitionTimerMs` as the freeze gate, and removing the unused `Player.respawnTimerMs` field from the draft data model.
- Standardized the HUD contract so every state shows score, wave, and lives; the start-screen wireframe now renders `WAVE 1` instead of a partial HUD.
- Resolved the keyboard-spec conflict by removing the extra `confirmPressed` input and reusing `Space` for start, next-wave, and restart interactions outside active play.
- Clarified audio startup so `AudioContext` is created or resumed only from the first user gesture, with a visible mute fallback if that still fails.
- Picked one invader representation: `invaders[]` now contains only live invaders, so collision cleanup, speed-up, and wave-clear all key off `invaders.length`.
- Tightened execution gates by calling out the required `build` script for `pnpm build` and by elevating ESLint's zero-warning bar in the plan.

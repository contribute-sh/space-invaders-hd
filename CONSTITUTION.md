# Project Constitution

Version: 1.0.0
Date: 2026-04-21

## Purpose

A browser-playable Space Invaders game with modern hi-res graphics, frame-based animation, and short sound-effect feedback. Runs entirely in the browser with no backend. Vite dev server for local development; `pnpm build` produces a static bundle that can be hosted on any static host.

The MVP is the core playable loop — player + invader grid + projectiles + collisions + score + game-over. Richer art, multiple waves, and polish come in later phases.

## Principles

- **Deterministic game logic separated from rendering.** All gameplay state (position, score, lives, invader formation) lives in pure data. A `step(state, dt, input) → state` tick function is side-effect-free and unit-testable. Rendering reads the state and draws; it never mutates.
- **Canvas 2D for MVP.** No WebGL, no shader pipelines, no DOM-based entities. A single `<canvas>` element covers the play area.
- **Zero runtime dependencies.** Everything ships from the TypeScript source. No React, no game engine, no animation library.
- **60fps budget, fixed-timestep simulation.** The loop runs at a fixed simulation rate independent of rendering; dropped frames don't break gameplay.
- **Keyboard only in MVP.** Arrow keys move, space shoots, `P` pauses. Gamepad/touch are not in scope.

## Stack

- language: typescript
- package_manager: pnpm
- install: pnpm install --frozen-lockfile
- test: pnpm vitest run
- lint: pnpm eslint .
- typecheck: pnpm tsc --noEmit
- build: pnpm build

## Boundaries

- Will NOT add runtime dependencies. MVP is pure TypeScript + standard browser APIs.
- Will NOT use a game engine (Phaser, Pixi, Excalibur, etc.) — direct Canvas 2D only.
- Will NOT depend on asset files larger than trivially small (<50 KB total). Sprites can be procedurally drawn shapes + colors for the MVP; real art comes in Polish phase.
- Will NOT use CSS frameworks. Inline minimal CSS for the page shell only.
- Will NOT require a backend or external service. All state lives in memory; the `highScore` persists via `localStorage` only.

## Quality Standards

- `pnpm tsc --noEmit` passes with `strict: true` and `noUncheckedIndexedAccess: true`.
- `pnpm vitest run` passes with >= 20 cases covering the pure `step()` tick function: movement, shoot, collisions, invader march, speed-up as invaders are killed, player death, wave clear.
- `pnpm eslint .` passes with zero warnings.
- `pnpm build` emits a working static bundle under `dist/` including an `index.html` entrypoint.
- Game state and input types are fully typed; no `any`.

## Roadmap

### MVP

- Scaffold the project: `package.json` with the declared stack commands, `tsconfig.json` (strict), `eslint.config.js` (flat), `vitest.config.ts`, `index.html` with a `<canvas>` entry, `src/main.ts` boot shim.
- Pure simulation in `src/game/state.ts` + `src/game/step.ts`: `GameState` type + `step(state, dt, input) → state` handling player movement, shooting, invader grid march, bullet–invader collision, invader–player collision, score, lives, wave-clear.
- Keyboard input adapter in `src/input/keyboard.ts` producing a typed `Input` snapshot per frame.
- Canvas renderer in `src/render/canvas.ts` that reads `GameState` and draws player, invaders, bullets, score, lives. Pure geometry — shapes only, no loaded images.
- WebAudio SFX in `src/audio/sfx.ts` — short synthesized beeps for shoot / hit / player-death / wave-clear. No external audio files.
- `src/main.ts` bootstrap wires input → step → render at a 60 Hz fixed timestep with `requestAnimationFrame`.
- Vitest suite in `src/game/step.test.ts` covering >= 20 cases of the pure simulation.

### Hardening

- Sprite-sheet rendering in place of plain shapes (still procedural — generated from a small JSON sprite descriptor, no external image files).
- Animation frames for invader march and player shoot.
- Additional test cases (>= 30 total).
- High-score persisted via `localStorage`.

### Polish

- Hi-res parallax starfield background.
- Short background music loop via WebAudio.
- Explosion animations.
- Multiple waves with increasing difficulty.

## Verification

- type: web
- build: pnpm build
- serve: pnpm vite preview --port 5173
- url: http://localhost:5173
- ready_signal: Local:
- acceptance:
  - canvas element visible
  - pressing arrow keys moves the player ship
  - pressing space fires a bullet

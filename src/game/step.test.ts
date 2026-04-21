import { describe, expect, it } from "vitest";

import {
  EMPTY_INPUT,
  INVADER_COLS,
  INVADER_HEIGHT,
  INVADER_ROWS,
  LIFE_LOST_DURATION_MS,
  PLAYER_SHOOT_COOLDOWN_MS,
  PROJECTILE_HEIGHT,
  STARTING_LIVES,
  createGameState,
  createPlayingState,
  getFormationSpeed,
  getPlayerMaxX,
  getPlayerMinX
} from "./state";
import { step } from "./step";

describe("step", () => {
  it("keeps the start screen active without confirm input", () => {
    const state = createGameState({ phase: "start" });

    const next = step(state, 16, EMPTY_INPUT);

    expect(next.phase).toBe("start");
    expect(next.hud.wave).toBe(1);
  });

  it("starts a fresh run from the start screen", () => {
    const state = createGameState({ phase: "start", score: 120, lives: 1 });

    const next = step(state, 16, { ...EMPTY_INPUT, firePressed: true });

    expect(next.phase).toBe("playing");
    expect(next.hud.score).toBe(0);
    expect(next.hud.lives).toBe(STARTING_LIVES);
    expect(next.invaders).toHaveLength(INVADER_ROWS * INVADER_COLS);
  });

  it("moves the player left while playing", () => {
    const state = createPlayingState();

    const next = step(state, 100, { ...EMPTY_INPUT, moveX: -1 });

    expect(next.player.x).toBeLessThan(state.player.x);
  });

  it("clamps the player at the left edge", () => {
    const state = {
      ...createPlayingState(),
      player: {
        ...createPlayingState().player,
        x: getPlayerMinX(createPlayingState().arena)
      }
    };

    const next = step(state, 100, { ...EMPTY_INPUT, moveX: -1 });

    expect(next.player.x).toBe(getPlayerMinX(state.arena));
  });

  it("clamps the player at the right edge", () => {
    const base = createPlayingState();
    const state = {
      ...base,
      player: {
        ...base.player,
        x: getPlayerMaxX(base.arena, base.player)
      }
    };

    const next = step(state, 100, { ...EMPTY_INPUT, moveX: 1 });

    expect(next.player.x).toBe(getPlayerMaxX(state.arena, state.player));
  });

  it("fires a projectile when the cooldown is ready", () => {
    const state = createPlayingState();

    const next = step(state, 16, { ...EMPTY_INPUT, firePressed: true });

    expect(next.projectiles).toHaveLength(1);
    expect(next.player.shootCooldownMs).toBe(PLAYER_SHOOT_COOLDOWN_MS);
  });

  it("does not fire another projectile while the cooldown is active", () => {
    const fired = step(createPlayingState(), 16, {
      ...EMPTY_INPUT,
      firePressed: true
    });

    const next = step(fired, 16, { ...EMPTY_INPUT, firePressed: true });

    expect(next.projectiles).toHaveLength(1);
  });

  it("moves projectiles upward", () => {
    const fired = step(createPlayingState(), 16, {
      ...EMPTY_INPUT,
      firePressed: true
    });
    const projectile = fired.projectiles[0];

    const next = step(fired, 100, EMPTY_INPUT);

    expect(projectile).toBeDefined();
    expect(next.projectiles[0]?.y).toBeLessThan(projectile?.y ?? Infinity);
  });

  it("removes projectiles that leave the arena", () => {
    const base = createPlayingState();
    const projectile = {
      id: 1,
      owner: "player" as const,
      x: base.player.x,
      y: -PROJECTILE_HEIGHT + 1,
      width: 6,
      height: PROJECTILE_HEIGHT,
      velocityY: -720,
      active: true
    };
    const state = {
      ...base,
      projectiles: [projectile],
      nextProjectileId: 2
    };

    const next = step(state, 16, EMPTY_INPUT);

    expect(next.projectiles).toHaveLength(0);
  });

  it("destroys an invader and adds score on hit", () => {
    const base = createPlayingState();
    const invader = base.invaders[0];
    expect(invader).toBeDefined();
    const projectile = {
      id: 1,
      owner: "player" as const,
      x: invader?.x ?? 0,
      y: (invader?.y ?? 0) + 6,
      width: invader?.width ?? 0,
      height: invader?.height ?? 0,
      velocityY: 0,
      active: true
    };
    const state = {
      ...base,
      invaders: invader === undefined ? [] : [invader],
      projectiles: [projectile],
      nextProjectileId: 2
    };

    const next = step(state, 0, EMPTY_INPUT);

    expect(next.invaders).toHaveLength(0);
    expect(next.hud.score).toBe((invader?.points ?? 0) + base.hud.score);
  });

  it("consumes only the projectile that hit an invader", () => {
    const base = createPlayingState();
    const invaderA = base.invaders[0];
    const invaderB = base.invaders[1];
    expect(invaderA).toBeDefined();
    expect(invaderB).toBeDefined();
    const state = {
      ...base,
      invaders:
        invaderA !== undefined && invaderB !== undefined
          ? [invaderA, invaderB]
          : [],
      projectiles: [
        {
          id: 1,
          owner: "player" as const,
          x: invaderA?.x ?? 0,
          y: invaderA?.y ?? 0,
          width: invaderA?.width ?? 0,
          height: invaderA?.height ?? 0,
          velocityY: 0,
          active: true
        },
        {
          id: 2,
          owner: "player" as const,
          x: invaderB?.x ?? 0,
          y: (invaderB?.y ?? 0) - 40,
          width: 6,
          height: 18,
          velocityY: 0,
          active: true
        }
      ],
      nextProjectileId: 3
    };

    const next = step(state, 0, EMPTY_INPUT);

    expect(next.invaders).toHaveLength(1);
    expect(next.projectiles).toHaveLength(1);
  });

  it("enters wave clear when the last invader is destroyed", () => {
    const base = createPlayingState();
    const invader = base.invaders[0];
    expect(invader).toBeDefined();
    const state = {
      ...base,
      invaders: invader === undefined ? [] : [invader],
      projectiles: [
        {
          id: 1,
          owner: "player" as const,
          x: invader?.x ?? 0,
          y: invader?.y ?? 0,
          width: invader?.width ?? 0,
          height: invader?.height ?? 0,
          velocityY: 0,
          active: true
        }
      ]
    };

    const next = step(state, 0, EMPTY_INPUT);

    expect(next.phase).toBe("waveClear");
    expect(next.projectiles).toHaveLength(0);
  });

  it("starts the next wave from wave clear and preserves score and lives", () => {
    const state = createGameState({
      phase: "waveClear",
      wave: 2,
      score: 310,
      lives: 2
    });

    const next = step(state, 16, { ...EMPTY_INPUT, firePressed: true });

    expect(next.phase).toBe("playing");
    expect(next.hud.wave).toBe(3);
    expect(next.hud.score).toBe(310);
    expect(next.hud.lives).toBe(2);
  });

  it("pauses from active play", () => {
    const state = createPlayingState();

    const next = step(state, 16, { ...EMPTY_INPUT, pausePressed: true });

    expect(next.phase).toBe("paused");
  });

  it("keeps the paused state frozen without resume input", () => {
    const state = createGameState({ phase: "paused", score: 55, lives: 2 });

    const next = step(state, 200, { moveX: 1, firePressed: true, pausePressed: false });

    expect(next).toEqual(state);
  });

  it("resumes play from pause with P", () => {
    const state = createGameState({ phase: "paused" });

    const next = step(state, 16, { ...EMPTY_INPUT, pausePressed: true });

    expect(next.phase).toBe("playing");
  });

  it("marches invaders horizontally", () => {
    const state = createPlayingState();
    const startX = state.invaders[0]?.x ?? 0;

    const next = step(state, 100, EMPTY_INPUT);

    expect(next.invaders[0]?.x).toBeGreaterThan(startX);
  });

  it("reverses direction and descends at the right edge", () => {
    const base = createPlayingState();
    const shift =
      base.formation.rightBound - (base.invaders[10]?.x ?? 0) - (base.invaders[10]?.width ?? 0);
    const invaders = base.invaders.map((invader) => ({
      ...invader,
      x: invader.x + shift
    }));
    const state = {
      ...base,
      invaders
    };
    const startY = state.invaders[0]?.y ?? 0;

    const next = step(state, 250, EMPTY_INPUT);

    expect(next.formation.direction).toBe(-1);
    expect(next.invaders[0]?.y).toBeGreaterThan(startY);
  });

  it("speeds up the formation as invaders are removed", () => {
    const full = createPlayingState();
    const reduced = {
      ...createPlayingState(),
      invaders: createPlayingState().invaders.slice(0, 5)
    };

    const fullNext = step(full, 1000, EMPTY_INPUT);
    const reducedNext = step(reduced, 1000, EMPTY_INPUT);
    const fullDelta = (fullNext.invaders[0]?.x ?? 0) - (full.invaders[0]?.x ?? 0);
    const reducedDelta = (reducedNext.invaders[0]?.x ?? 0) - (reduced.invaders[0]?.x ?? 0);

    expect(reducedDelta).toBeGreaterThan(fullDelta);
    expect(getFormationSpeed(reduced.invaders.length, reduced.formation.speed)).toBeGreaterThan(
      getFormationSpeed(full.invaders.length, full.formation.speed)
    );
  });

  it("enters life lost when invaders reach the player line", () => {
    const base = createPlayingState();
    const invader = base.invaders[0];
    expect(invader).toBeDefined();
    const state = {
      ...base,
      invaders:
        invader === undefined
          ? []
          : [
              {
                ...invader,
                y: base.player.y - INVADER_HEIGHT + 2
              }
            ]
    };

    const next = step(state, 0, EMPTY_INPUT);

    expect(next.phase).toBe("lifeLost");
    expect(next.hud.lives).toBe(base.hud.lives - 1);
    expect(next.transitionTimerMs).toBe(LIFE_LOST_DURATION_MS);
  });

  it("ignores movement and firing during life lost freeze", () => {
    const base = createPlayingState({ lives: 2 });
    const lifeLost = {
      ...base,
      phase: "lifeLost" as const,
      transitionTimerMs: LIFE_LOST_DURATION_MS,
      player: {
        ...base.player,
        shootCooldownMs: 0
      }
    };

    const next = step(lifeLost, 100, {
      moveX: 1,
      firePressed: true,
      pausePressed: true
    });

    expect(next.phase).toBe("lifeLost");
    expect(next.transitionTimerMs).toBe(LIFE_LOST_DURATION_MS - 100);
    expect(next.player).toEqual(lifeLost.player);
    expect(next.projectiles).toEqual(lifeLost.projectiles);
  });

  it("resets the current wave after life lost when lives remain", () => {
    const base = createPlayingState({ wave: 2, score: 440, lives: 2 });
    const lifeLost = {
      ...base,
      phase: "lifeLost" as const,
      transitionTimerMs: 50,
      invaders: base.invaders.slice(0, 7),
      projectiles: [
        {
          id: 2,
          owner: "player" as const,
          x: 0,
          y: 0,
          width: 6,
          height: 18,
          velocityY: -720,
          active: true
        }
      ]
    };

    const next = step(lifeLost, 60, EMPTY_INPUT);

    expect(next.phase).toBe("playing");
    expect(next.hud.wave).toBe(2);
    expect(next.hud.score).toBe(440);
    expect(next.hud.lives).toBe(2);
    expect(next.invaders).toHaveLength(INVADER_ROWS * INVADER_COLS);
    expect(next.projectiles).toHaveLength(0);
  });

  it("transitions to game over after the final life is lost", () => {
    const base = createPlayingState({ lives: 0, score: 999 });
    const lifeLost = {
      ...base,
      phase: "lifeLost" as const,
      transitionTimerMs: 20
    };

    const next = step(lifeLost, 25, EMPTY_INPUT);

    expect(next.phase).toBe("gameOver");
    expect(next.hud.score).toBe(999);
  });

  it("restarts a fresh run from game over", () => {
    const state = createGameState({
      phase: "gameOver",
      wave: 4,
      score: 650,
      lives: 0
    });

    const next = step(state, 16, { ...EMPTY_INPUT, firePressed: true });

    expect(next.phase).toBe("playing");
    expect(next.hud.score).toBe(0);
    expect(next.hud.wave).toBe(1);
    expect(next.hud.lives).toBe(STARTING_LIVES);
  });

  it("keeps wave clear active without confirm input", () => {
    const state = createGameState({ phase: "waveClear", wave: 3, score: 220 });

    const next = step(state, 16, EMPTY_INPUT);

    expect(next.phase).toBe("waveClear");
    expect(next.hud.score).toBe(220);
  });
});

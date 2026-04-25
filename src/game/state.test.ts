import { describe, expect, it } from "vitest";

import {
  EMPTY_INPUT,
  FORMATION_SPEED_BASE,
  FORMATION_SPEED_MAX,
  INVADER_PROJECTILE_WIDTH,
  assignInput,
  cloneInput,
  createGameState,
  createPauseInput,
  getFormationSpeed,
  getInvaderProjectileSpawnX,
  getInvaderProjectileSpawnY,
  getProjectileSpawnX,
  getProjectileSpawnY,
  getPlayerMaxX,
  getPlayerMinX,
  PROJECTILE_HEIGHT,
  PROJECTILE_WIDTH,
  type Arena,
  type Invader,
  type Input,
  type Player
} from "./state";
import { step } from "./step";

function getInputKeys(): Array<keyof Input> {
  return Object.keys(EMPTY_INPUT) as Array<keyof Input>;
}

function expectInputFields(actual: Input, expected: Input): void {
  for (const key of getInputKeys()) {
    expect(actual[key]).toBe(expected[key]);
  }
}

describe("getFormationSpeed", () => {
  // Mirrors the private FORMATION_SPEED_KILL_MULTIPLIER implementation constant.
  const expectedKillMultiplier = 2.7;

  it("returns the wave start speed when invaderCount exceeds totalInvaders", () => {
    const waveStartSpeed = FORMATION_SPEED_BASE * 2;

    expect(getFormationSpeed(99, waveStartSpeed, 10)).toBe(waveStartSpeed);
  });

  it("treats negative invaderCount as a fully cleared formation", () => {
    const waveStartSpeed = FORMATION_SPEED_BASE * 2;

    expect(getFormationSpeed(-1, waveStartSpeed, 10)).toBe(
      FORMATION_SPEED_MAX
    );
  });

  it("caps waveStartSpeed at FORMATION_SPEED_MAX before scaling when all invaders are alive", () => {
    expect(getFormationSpeed(10, FORMATION_SPEED_MAX * 2, 10)).toBe(
      FORMATION_SPEED_MAX
    );
  });

  it("returns a finite number when totalInvaders is zero", () => {
    expect(Number.isFinite(getFormationSpeed(0, FORMATION_SPEED_BASE, 0))).toBe(
      true
    );
  });

  it("returns the wave start speed exactly when all invaders are alive below the cap", () => {
    const waveStartSpeed = 100;

    expect(getFormationSpeed(10, waveStartSpeed, 10)).toBe(waveStartSpeed);
  });

  it("uses the uncapped kill multiplier when no invaders remain and the scaled speed stays below the cap", () => {
    const waveStartSpeed = 100;

    expect(getFormationSpeed(0, waveStartSpeed, 10)).toBeCloseTo(
      waveStartSpeed * expectedKillMultiplier
    );
  });

  it("clamps the fully cleared formation speed to FORMATION_SPEED_MAX when the kill multiplier would exceed it", () => {
    const waveStartSpeed = 120;

    expect(waveStartSpeed * expectedKillMultiplier).toBeGreaterThan(
      FORMATION_SPEED_MAX
    );

    expect(getFormationSpeed(0, waveStartSpeed, 10)).toBe(
      FORMATION_SPEED_MAX
    );
  });

  it("returns the linearly interpolated halfway speed between the wave start and fully cleared speeds", () => {
    const totalInvaders = 10;
    const invaderCount = totalInvaders / 2;
    const waveStartSpeed = 100;
    const fullyClearedSpeed = waveStartSpeed * expectedKillMultiplier;
    const halfwaySpeed = getFormationSpeed(
      invaderCount,
      waveStartSpeed,
      totalInvaders
    );

    expect(halfwaySpeed).toBeGreaterThan(waveStartSpeed);
    expect(halfwaySpeed).toBeLessThan(fullyClearedSpeed);
    expect(halfwaySpeed).toBeCloseTo(
      waveStartSpeed + (fullyClearedSpeed - waveStartSpeed) / 2
    );
  });

  it("never decreases as invaderCount drops toward zero", () => {
    const waveStartSpeed = 100;
    const totalInvaders = 10;
    const sampledInvaderCounts = [10, 8, 5, 2, 0] as const;
    let previousSpeed = getFormationSpeed(
      sampledInvaderCounts[0],
      waveStartSpeed,
      totalInvaders
    );

    for (const invaderCount of sampledInvaderCounts.slice(1)) {
      const currentSpeed = getFormationSpeed(
        invaderCount,
        waveStartSpeed,
        totalInvaders
      );

      expect(currentSpeed).toBeGreaterThanOrEqual(previousSpeed);
      previousSpeed = currentSpeed;
    }
  });
});

describe("getPlayerMinX", () => {
  it("returns the arena padding", () => {
    const arena: Arena = {
      width: 960,
      height: 720,
      floorY: 664,
      padding: 56
    };

    expect(getPlayerMinX(arena)).toBe(arena.padding);
  });

  it("shifts upward when arena padding increases", () => {
    const tightArena: Arena = {
      width: 960,
      height: 720,
      floorY: 664,
      padding: 32
    };
    const paddedArena: Arena = {
      width: 960,
      height: 720,
      floorY: 664,
      padding: 80
    };

    expect(getPlayerMinX(paddedArena)).toBe(getPlayerMinX(tightArena) + 48);
  });
});

describe("getPlayerMaxX", () => {
  it("returns arena.width minus padding and player width", () => {
    const arena: Arena = {
      width: 960,
      height: 720,
      floorY: 664,
      padding: 56
    };
    const player: Player = {
      x: 442,
      y: 634,
      width: 76,
      height: 30,
      speed: 420,
      shootCooldownMs: 0,
      invulnerableUntilMs: 0
    };

    expect(getPlayerMaxX(arena, player)).toBe(
      arena.width - arena.padding - player.width
    );
  });

  it("reduces the maximum x by the player width delta for a wider player", () => {
    const arena: Arena = {
      width: 960,
      height: 720,
      floorY: 664,
      padding: 56
    };
    const narrowPlayer: Player = {
      x: 448,
      y: 634,
      width: 64,
      height: 30,
      speed: 420,
      shootCooldownMs: 0,
      invulnerableUntilMs: 0
    };
    const widePlayer: Player = {
      x: 436,
      y: 634,
      width: 88,
      height: 30,
      speed: 420,
      shootCooldownMs: 0,
      invulnerableUntilMs: 0
    };
    const widthDelta = widePlayer.width - narrowPlayer.width;

    expect(getPlayerMaxX(arena, narrowPlayer) - getPlayerMaxX(arena, widePlayer)).toBe(widthDelta);
  });

  it("shifts downward symmetrically when arena padding increases", () => {
    const player: Player = {
      x: 442,
      y: 634,
      width: 76,
      height: 30,
      speed: 420,
      shootCooldownMs: 0,
      invulnerableUntilMs: 0
    };
    const tightArena: Arena = {
      width: 960,
      height: 720,
      floorY: 664,
      padding: 32
    };
    const paddedArena: Arena = {
      width: 960,
      height: 720,
      floorY: 664,
      padding: 80
    };
    const paddingDelta = paddedArena.padding - tightArena.padding;

    expect(getPlayerMinX(paddedArena) - getPlayerMinX(tightArena)).toBe(
      paddingDelta
    );
    expect(
      getPlayerMaxX(tightArena, player) - getPlayerMaxX(paddedArena, player)
    ).toBe(paddingDelta);
  });
});

describe("EMPTY_INPUT", () => {
  it("uses neutral defaults for every field", () => {
    expect(EMPTY_INPUT.moveX).toBe(0);

    for (const key of getInputKeys()) {
      expect(EMPTY_INPUT[key]).toBe(key === "moveX" ? 0 : false);
    }
  });
});

describe("cloneInput", () => {
  it("returns a distinct clone of EMPTY_INPUT and does not mutate EMPTY_INPUT when the clone changes", () => {
    const emptyInputSnapshot: Input = { ...EMPTY_INPUT };
    const clonedInput = cloneInput(EMPTY_INPUT);

    expect(clonedInput).not.toBe(EMPTY_INPUT);
    expectInputFields(clonedInput, EMPTY_INPUT);

    clonedInput.moveX = 1;
    clonedInput.firePressed = true;
    clonedInput.pauseHeld = true;

    expectInputFields(EMPTY_INPUT, emptyInputSnapshot);
  });

  it("copies every field from a populated input", () => {
    const original: Input = {
      moveX: 1,
      firePressed: true,
      pausePressed: true,
      fireHeld: true,
      pauseHeld: true,
      mutePressed: true
    };
    const clonedInput = cloneInput(original);

    expect(clonedInput).not.toBe(original);
    expectInputFields(clonedInput, original);
  });
});

describe("assignInput", () => {
  it("updates the existing target in place so every field matches the source", () => {
    const target: Input = {
      moveX: -1,
      firePressed: false,
      pausePressed: true,
      fireHeld: false,
      pauseHeld: true,
      mutePressed: false
    };
    const source: Input = {
      moveX: 1,
      firePressed: true,
      pausePressed: false,
      fireHeld: true,
      pauseHeld: false,
      mutePressed: true
    };
    const targetReference = target;
    const sourceSnapshot: Input = { ...source };

    assignInput(target, source);

    expect(target).toBe(targetReference);
    expectInputFields(target, sourceSnapshot);
  });

  it("resets a populated target back to EMPTY_INPUT", () => {
    const target: Input = {
      moveX: 1,
      firePressed: true,
      pausePressed: true,
      fireHeld: true,
      pauseHeld: true,
      mutePressed: true
    };

    assignInput(target, EMPTY_INPUT);

    expectInputFields(target, EMPTY_INPUT);
  });
});

describe("createPauseInput", () => {
  it("sets only pausePressed and is accepted by step while paused", () => {
    const pauseInput = createPauseInput();

    expect(pauseInput.pausePressed).toBe(true);
    for (const key of getInputKeys()) {
      if (key === "pausePressed") {
        continue;
      }

      expect(pauseInput[key]).toBe(EMPTY_INPUT[key]);
    }

    const pausedState = createGameState({ phase: "paused" });
    const advancePausedState = () => step(pausedState, 16, pauseInput);

    expect(advancePausedState).not.toThrow();

    const next = advancePausedState();

    expect(next.state).toEqual(expect.objectContaining({ phase: "playing" }));
  });
});

describe("getProjectileSpawnX", () => {
  it("centers a projectile on a wider player using the exact width-based formula", () => {
    const player = {
      x: 442,
      y: 634,
      width: 76,
      height: 30,
      speed: 420,
      shootCooldownMs: 0,
      invulnerableUntilMs: 0
    } satisfies Player;

    expect(getProjectileSpawnX(player)).toBe(
      player.x + (player.width - PROJECTILE_WIDTH) / 2
    );
  });

  it("returns the player's x unchanged when the player width matches the projectile width", () => {
    const player = {
      x: 180,
      y: 320,
      width: PROJECTILE_WIDTH,
      height: 30,
      speed: 420,
      shootCooldownMs: 0,
      invulnerableUntilMs: 0
    } satisfies Player;

    expect(getProjectileSpawnX(player)).toBe(player.x);
  });

  it("returns a spawn x left of the player when the player is narrower than the projectile", () => {
    const player = {
      x: 120,
      y: 320,
      width: PROJECTILE_WIDTH - 2,
      height: 30,
      speed: 420,
      shootCooldownMs: 0,
      invulnerableUntilMs: 0
    } satisfies Player;

    expect(getProjectileSpawnX(player)).toBe(
      player.x + (player.width - PROJECTILE_WIDTH) / 2
    );
    expect(getProjectileSpawnX(player)).toBeLessThan(player.x);
  });
});

describe("getProjectileSpawnY", () => {
  it("places a player projectile flush above the player's top edge", () => {
    const player = {
      x: 442,
      y: 634,
      width: 76,
      height: 30,
      speed: 420,
      shootCooldownMs: 0,
      invulnerableUntilMs: 0
    } satisfies Player;

    expect(getProjectileSpawnY(player)).toBe(player.y - PROJECTILE_HEIGHT);
  });

  it("does not clamp a player at y zero", () => {
    const player = {
      x: 180,
      y: 0,
      width: 76,
      height: 30,
      speed: 420,
      shootCooldownMs: 0,
      invulnerableUntilMs: 0
    } satisfies Player;

    expect(getProjectileSpawnY(player)).toBe(-PROJECTILE_HEIGHT);
  });
});

describe("getInvaderProjectileSpawnX", () => {
  it("centers the projectile horizontally for a narrow invader near the left side", () => {
    const invader: Invader = {
      id: 1,
      row: 0,
      col: 0,
      x: 24,
      y: 96,
      width: 40,
      height: 28,
      points: 50
    };

    expect(getInvaderProjectileSpawnX(invader)).toBe(
      invader.x + invader.width / 2 - INVADER_PROJECTILE_WIDTH / 2
    );
  });

  it("centers the projectile horizontally for a wider invader at an offset position", () => {
    const invader: Invader = {
      id: 2,
      row: 3,
      col: 7,
      x: 315,
      y: 204,
      width: 62,
      height: 34,
      points: 20
    };

    expect(getInvaderProjectileSpawnX(invader)).toBe(
      invader.x + invader.width / 2 - INVADER_PROJECTILE_WIDTH / 2
    );
  });
});

describe("getInvaderProjectileSpawnY", () => {
  it("places the projectile flush with the bottom edge of a shorter invader", () => {
    const invader: Invader = {
      id: 3,
      row: 1,
      col: 4,
      x: 180,
      y: 120,
      width: 48,
      height: 24,
      points: 40
    };

    expect(getInvaderProjectileSpawnY(invader)).toBe(
      invader.y + invader.height
    );
  });

  it("places the projectile flush with the bottom edge of a taller invader lower in the arena", () => {
    const invader: Invader = {
      id: 4,
      row: 4,
      col: 9,
      x: 468,
      y: 312,
      width: 56,
      height: 38,
      points: 10
    };

    expect(getInvaderProjectileSpawnY(invader)).toBe(
      invader.y + invader.height
    );
  });
});

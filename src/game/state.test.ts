import { describe, expect, it } from "vitest";

import {
  EMPTY_INPUT,
  FORMATION_SPEED_BASE,
  FORMATION_SPEED_MAX,
  INVADER_PROJECTILE_WIDTH,
  assignInput,
  cloneInput,
  createGameState,
  createInvaderProjectile,
  createPauseInput,
  createPlayingState,
  getFormationSpeed,
  getInvaderProjectileSpawnX,
  getInvaderProjectileSpawnY,
  type Invader,
  type Input
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

  it("caps waveStartSpeed at FORMATION_SPEED_MAX before interpolation", () => {
    expect(getFormationSpeed(5, FORMATION_SPEED_MAX * 2, 10)).toBe(
      FORMATION_SPEED_MAX
    );
  });

  it("returns a finite number when totalInvaders is zero", () => {
    expect(Number.isFinite(getFormationSpeed(0, FORMATION_SPEED_BASE, 0))).toBe(
      true
    );
  });

  it("interpolates halfway between the capped wave start speed and FORMATION_SPEED_MAX", () => {
    const waveStartSpeed = FORMATION_SPEED_BASE * 2;

    expect(getFormationSpeed(5, waveStartSpeed, 10)).toBe(
      waveStartSpeed + (FORMATION_SPEED_MAX - waveStartSpeed) / 2
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

  it("clamps the fully cleared formation speed to FORMATION_SPEED_MAX", () => {
    const waveStartSpeed = FORMATION_SPEED_MAX;

    expect(getFormationSpeed(0, waveStartSpeed, 10)).toBe(
      FORMATION_SPEED_MAX
    );
  });

  it("interpolates halfway between the wave start speed and the uncapped kill-multiplied speed", () => {
    const totalInvaders = 10;
    const invaderCount = 5;
    const waveStartSpeed = 100;
    const expectedMaxSpeed = waveStartSpeed * expectedKillMultiplier;

    expect(
      getFormationSpeed(invaderCount, waveStartSpeed, totalInvaders)
    ).toBeCloseTo(waveStartSpeed + (expectedMaxSpeed - waveStartSpeed) / 2);
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

describe("EMPTY_INPUT", () => {
  it("uses neutral defaults for every field", () => {
    expect(EMPTY_INPUT.moveX).toBe(0);

    for (const key of getInputKeys()) {
      expect(EMPTY_INPUT[key]).toBe(key === "moveX" ? 0 : false);
    }
  });
});

describe("cloneInput", () => {
  it("copies every field into a distinct object without aliasing later mutations", () => {
    const original: Input = {
      moveX: -1,
      firePressed: true,
      pausePressed: true,
      fireHeld: true,
      pauseHeld: true,
      mutePressed: true
    };
    const originalSnapshot: Input = { ...original };
    const clonedInput = cloneInput(original);

    expect(clonedInput).toEqual(original);
    expect(clonedInput).not.toBe(original);
    expectInputFields(clonedInput, original);

    for (const key of getInputKeys()) {
      if (key === "moveX") {
        clonedInput[key] = 0;
      } else {
        clonedInput[key] = false;
      }
    }

    expectInputFields(original, originalSnapshot);
  });
});

describe("assignInput", () => {
  it("copies every field into the existing target without aliasing later source mutations", () => {
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

    for (const key of getInputKeys()) {
      if (key === "moveX") {
        source[key] = 0;
      } else {
        source[key] = !source[key];
      }
    }

    expectInputFields(target, sourceSnapshot);
  });

  it("clears a populated target when assigning EMPTY_INPUT", () => {
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

describe("invader projectile spawn helpers", () => {
  const invader: Invader = {
    id: 7,
    row: 2,
    col: 3,
    x: 111,
    y: 222,
    width: 54,
    height: 31,
    points: 20
  };

  it("centers the projectile horizontally on the invader", () => {
    expect(getInvaderProjectileSpawnX(invader)).toBe(
      invader.x + invader.width / 2 - INVADER_PROJECTILE_WIDTH / 2
    );
  });

  it("places the projectile flush with the invader bottom edge", () => {
    expect(getInvaderProjectileSpawnY(invader)).toBe(
      invader.y + invader.height
    );
  });

  it("uses the helper coordinates when creating an invader projectile", () => {
    const projectile = createInvaderProjectile(
      createPlayingState({ nextProjectileId: 42 }),
      invader
    );

    expect(projectile.x).toBe(getInvaderProjectileSpawnX(invader));
    expect(projectile.y).toBe(getInvaderProjectileSpawnY(invader));
  });
});

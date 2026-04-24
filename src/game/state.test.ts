/// <reference types="vite/client" />

import { describe, expect, it } from "vitest";

import stateSource from "./state?raw";
import {
  EMPTY_INPUT,
  FORMATION_SPEED_BASE,
  FORMATION_SPEED_MAX,
  INVADER_PROJECTILE_WIDTH,
  assignInput,
  cloneInput,
  createInvaderProjectile,
  createPauseInput,
  createPlayingState,
  getFormationSpeed,
  getInvaderProjectileSpawnX,
  getInvaderProjectileSpawnY,
  type Invader,
  type Input
} from "./state";

const formationSpeedKillMultiplierMatch = stateSource.match(
  /const FORMATION_SPEED_KILL_MULTIPLIER = ([0-9.]+);/
);

if (!formationSpeedKillMultiplierMatch) {
  throw new Error("FORMATION_SPEED_KILL_MULTIPLIER not found in state.ts");
}

const [, formationSpeedKillMultiplierText] = formationSpeedKillMultiplierMatch;

if (!formationSpeedKillMultiplierText) {
  throw new Error("FORMATION_SPEED_KILL_MULTIPLIER value not found in state.ts");
}

const FORMATION_SPEED_KILL_MULTIPLIER = Number.parseFloat(
  formationSpeedKillMultiplierText
);

function getInputKeys(): Array<keyof Input> {
  return Object.keys(EMPTY_INPUT) as Array<keyof Input>;
}

describe("getFormationSpeed", () => {
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

  it("returns the wave start speed when all invaders are still alive", () => {
    const totalInvaders = 10;
    const waveStartSpeed = FORMATION_SPEED_BASE;

    expect(
      getFormationSpeed(totalInvaders, waveStartSpeed, totalInvaders)
    ).toBe(waveStartSpeed);
  });

  it("applies the kill multiplier for a cleared formation below the cap", () => {
    const waveStartSpeed = FORMATION_SPEED_BASE;

    expect(getFormationSpeed(0, waveStartSpeed, 10)).toBeCloseTo(
      waveStartSpeed * FORMATION_SPEED_KILL_MULTIPLIER
    );
  });

  it("clamps a cleared formation to FORMATION_SPEED_MAX when the multiplied speed exceeds the cap", () => {
    expect(getFormationSpeed(0, FORMATION_SPEED_MAX * 2, 10)).toBe(
      FORMATION_SPEED_MAX
    );
  });

  it("interpolates halfway between the wave start speed and kill-multiplied speed when the formation is half cleared", () => {
    const waveStartSpeed = FORMATION_SPEED_BASE;
    const waveMaxSpeed =
      waveStartSpeed * FORMATION_SPEED_KILL_MULTIPLIER;

    expect(getFormationSpeed(5, waveStartSpeed, 10)).toBeCloseTo(
      waveStartSpeed + (waveMaxSpeed - waveStartSpeed) / 2
    );
  });

  it("does not decrease as invaderCount drops", () => {
    const waveStartSpeed = FORMATION_SPEED_BASE;
    let previousSpeed = -Infinity;

    for (const invaderCount of [10, 8, 5, 2, 0]) {
      const speed = getFormationSpeed(invaderCount, waveStartSpeed, 10);

      expect(speed).toBeGreaterThanOrEqual(previousSpeed);
      previousSpeed = speed;
    }
  });
});

describe("input helpers", () => {
  it("round-trips every EMPTY_INPUT field through cloneInput", () => {
    const clonedInput = cloneInput(EMPTY_INPUT);

    expect(clonedInput).toEqual(EMPTY_INPUT);

    for (const key of getInputKeys()) {
      expect(clonedInput[key]).toEqual(EMPTY_INPUT[key]);
    }
  });

  it("copies every Input field through assignInput", () => {
    const target = cloneInput(EMPTY_INPUT);
    const source: Input = {
      moveX: 1,
      firePressed: true,
      pausePressed: true,
      fireHeld: true,
      pauseHeld: true,
      mutePressed: true
    };

    assignInput(target, source);

    for (const key of getInputKeys()) {
      expect(target[key]).toBe(source[key]);
    }
  });

  it("creates a pause-only input from EMPTY_INPUT defaults", () => {
    const pauseInput = createPauseInput();

    expect(pauseInput.pausePressed).toBe(true);

    for (const key of getInputKeys()) {
      if (key === "pausePressed") {
        continue;
      }

      expect(pauseInput[key]).toBe(EMPTY_INPUT[key]);
    }
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

import { describe, expect, it } from "vitest";

import {
  FORMATION_SPEED_BASE,
  FORMATION_SPEED_MAX,
  getFormationSpeed
} from "./state";

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
});

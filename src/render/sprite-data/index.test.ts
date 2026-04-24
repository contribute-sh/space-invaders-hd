import {
  INVADER_PROJECTILE_HEIGHT,
  INVADER_PROJECTILE_WIDTH,
  SHIELD_CELL_HEIGHT,
  SHIELD_CELL_WIDTH
} from "../../game/state";
import { getSprite } from "../sprites";
import {
  INVADER_PROJECTILE_DESCRIPTOR,
  PLAYER_PROJECTILE_DESCRIPTOR,
  SHIELD_CELL_DESCRIPTOR,
  SPRITE_DESCRIPTOR_REGISTRY
} from "./index";
import { describe, expect, it } from "vitest";

describe("SPRITE_DESCRIPTOR_REGISTRY", () => {
  it("registers shield-cell and invader-projectile as enumerable descriptors", () => {
    expect(Object.keys(SPRITE_DESCRIPTOR_REGISTRY)).toEqual(
      expect.arrayContaining(["shield-cell", "invader-projectile"])
    );
    expect(SPRITE_DESCRIPTOR_REGISTRY["shield-cell"]).toBe(SHIELD_CELL_DESCRIPTOR);
    expect(SPRITE_DESCRIPTOR_REGISTRY["invader-projectile"]).toBe(
      INVADER_PROJECTILE_DESCRIPTOR
    );
  });
});

describe("getSprite", () => {
  it("prepares shield-cell and invader-projectile through the public lookup path", () => {
    const shieldCell = getSprite("shield-cell");
    const invaderProjectile = getSprite("invader-projectile");

    expect(shieldCell.frameCount).toBeGreaterThanOrEqual(1);
    expect(shieldCell.sheet.getFrameCount()).toBeGreaterThanOrEqual(1);
    expect(shieldCell.width).toBe(SHIELD_CELL_WIDTH);
    expect(shieldCell.height).toBe(SHIELD_CELL_HEIGHT);

    expect(invaderProjectile.frameCount).toBeGreaterThanOrEqual(1);
    expect(invaderProjectile.sheet.getFrameCount()).toBeGreaterThanOrEqual(1);
    expect(invaderProjectile.width).toBe(INVADER_PROJECTILE_WIDTH);
    expect(invaderProjectile.height).toBe(INVADER_PROJECTILE_HEIGHT);
  });
});

describe("projectile descriptors", () => {
  it("use distinct palette colors for player and invader shots", () => {
    const playerProjectileColors = Object.values(PLAYER_PROJECTILE_DESCRIPTOR.palette);
    const invaderProjectileColors = Object.values(
      INVADER_PROJECTILE_DESCRIPTOR.palette
    );

    for (const color of invaderProjectileColors) {
      expect(playerProjectileColors).not.toContain(color);
    }
  });
});

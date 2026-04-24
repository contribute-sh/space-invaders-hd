import { describe, expect, it } from "vitest";

import {
  INVADER_PROJECTILE_DESCRIPTOR,
  PLAYER_PROJECTILE_DESCRIPTOR,
  SHIELD_CELL_DESCRIPTOR,
  SPRITE_DESCRIPTOR_REGISTRY
} from "./index";
import { getSprite } from "../sprites";

describe("SPRITE_DESCRIPTOR_REGISTRY", () => {
  it("registers shield-cell and invader-projectile descriptors", () => {
    expect(SPRITE_DESCRIPTOR_REGISTRY).toHaveProperty("shield-cell");
    expect(SPRITE_DESCRIPTOR_REGISTRY).toHaveProperty("invader-projectile");
    expect(SPRITE_DESCRIPTOR_REGISTRY["shield-cell"]).toBe(
      SHIELD_CELL_DESCRIPTOR
    );
    expect(SPRITE_DESCRIPTOR_REGISTRY["invader-projectile"]).toBe(
      INVADER_PROJECTILE_DESCRIPTOR
    );
  });
});

describe("getSprite", () => {
  it("prepares shield-cell and invader-projectile sprites from the public lookup path", () => {
    const shieldCellSprite = getSprite("shield-cell");
    const invaderProjectileSprite = getSprite("invader-projectile");

    expect(shieldCellSprite.frameCount).toBeGreaterThanOrEqual(1);
    expect(invaderProjectileSprite.frameCount).toBeGreaterThanOrEqual(1);
  });
});

describe("projectile descriptors", () => {
  it("uses distinct palette colors for player and invader projectiles", () => {
    expect(Object.values(INVADER_PROJECTILE_DESCRIPTOR.palette)).not.toEqual(
      Object.values(PLAYER_PROJECTILE_DESCRIPTOR.palette)
    );
  });
});

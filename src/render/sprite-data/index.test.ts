import { describe, expect, it } from "vitest";

import { getSprite } from "../sprites";
import {
  INVADER_PROJECTILE_DESCRIPTOR,
  SHIELD_CELL_DESCRIPTOR,
  SPRITE_DESCRIPTOR_REGISTRY,
  SPRITE_DESCRIPTORS
} from "./index";
import { PLAYER_PROJECTILE_DESCRIPTOR } from "./projectiles";

describe("sprite-data index", () => {
  it("registers the shield and invader projectile descriptors", () => {
    expect(SPRITE_DESCRIPTOR_REGISTRY["shield-cell"]).toBe(
      SHIELD_CELL_DESCRIPTOR
    );
    expect(SPRITE_DESCRIPTOR_REGISTRY["invader-projectile"]).toBe(
      INVADER_PROJECTILE_DESCRIPTOR
    );
    expect(Array.from(SPRITE_DESCRIPTORS).map((descriptor) => descriptor.id)).toEqual(
      expect.arrayContaining(["shield-cell", "invader-projectile"])
    );
  });

  it("resolves prepared sprites for shield cells and invader projectiles", () => {
    const shieldCellSprite = getSprite("shield-cell");
    const invaderProjectileSprite = getSprite("invader-projectile");

    expect(shieldCellSprite.frameCount).toBeGreaterThanOrEqual(1);
    expect(invaderProjectileSprite.frameCount).toBeGreaterThanOrEqual(1);
  });

  it("uses distinct palette colors for player and invader projectiles", () => {
    expect(Object.values(PLAYER_PROJECTILE_DESCRIPTOR.palette)[0]).not.toBe(
      Object.values(INVADER_PROJECTILE_DESCRIPTOR.palette)[0]
    );
  });
});

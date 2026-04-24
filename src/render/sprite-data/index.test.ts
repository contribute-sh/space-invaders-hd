import { describe, expect, it } from "vitest";

import { getSprite } from "../sprites";
import {
  INVADER_PROJECTILE_DESCRIPTOR,
  PLAYER_PROJECTILE_DESCRIPTOR,
  SHIELD_CELL_DESCRIPTOR,
  SPRITE_DESCRIPTOR_REGISTRY
} from "./index";

describe("SPRITE_DESCRIPTOR_REGISTRY", () => {
  it("registers and resolves shield-cell and invader-projectile through the public path", () => {
    const registryKeys = Object.keys(SPRITE_DESCRIPTOR_REGISTRY);

    for (const descriptor of [
      SHIELD_CELL_DESCRIPTOR,
      INVADER_PROJECTILE_DESCRIPTOR
    ]) {
      const sprite = getSprite(descriptor.id);

      expect(registryKeys).toContain(descriptor.id);
      expect(SPRITE_DESCRIPTOR_REGISTRY[descriptor.id]).toBe(descriptor);
      expect(descriptor.frames.length).toBeGreaterThanOrEqual(1);
      expect(sprite.frameCount).toBeGreaterThanOrEqual(1);
      expect(sprite.sheet.getFrameCount()).toBe(descriptor.frames.length);
    }
  });

  it("keeps player and invader projectile palettes visually distinct", () => {
    const playerColors = new Set(Object.values(PLAYER_PROJECTILE_DESCRIPTOR.palette));
    const invaderColors = new Set(
      Object.values(INVADER_PROJECTILE_DESCRIPTOR.palette)
    );

    expect(
      [...playerColors].some((color) => invaderColors.has(color))
    ).toBe(false);
  });
});

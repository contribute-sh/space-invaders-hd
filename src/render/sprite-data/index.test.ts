import { describe, expect, it } from "vitest";

import {
  INVADER_PROJECTILE_HEIGHT,
  INVADER_PROJECTILE_WIDTH,
  INVADER_ROWS,
  PLAYER_HEIGHT,
  PLAYER_WIDTH,
  PROJECTILE_HEIGHT,
  PROJECTILE_WIDTH
} from "../../game/state";
import { getSprite } from "../sprites";
import type { SpriteDescriptor } from "../sprites";
import {
  INVADER_PROJECTILE_DESCRIPTOR,
  INVADER_ROW_DESCRIPTORS,
  PLAYER_SHIP_DESCRIPTOR,
  PLAYER_PROJECTILE_DESCRIPTOR,
  SHIELD_CELL_DESCRIPTOR,
  SPRITE_DESCRIPTOR_REGISTRY
} from "./index";

function expectSpriteFootprintToMatchHitbox(
  descriptor: SpriteDescriptor,
  expectedWidth: number,
  expectedHeight: number
): void {
  expect(descriptor.frames.length).toBeGreaterThanOrEqual(1);

  const firstFrame = descriptor.frames[0];
  const frameRowCount = firstFrame?.length ?? 0;

  expect(frameRowCount).toBeGreaterThan(0);

  let maxRowLength = 0;

  for (const frame of descriptor.frames) {
    expect(frame.length).toBe(frameRowCount);

    const frameRowLength = frame[0]?.length ?? 0;

    expect(frameRowLength).toBeGreaterThan(0);

    for (const row of frame) {
      expect(row.length).toBe(frameRowLength);
    }

    maxRowLength = Math.max(maxRowLength, frameRowLength);
  }

  expect(maxRowLength * descriptor.pixelSize).toBe(expectedWidth);
  expect(frameRowCount * descriptor.pixelSize).toBe(expectedHeight);
}

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

describe("INVADER_ROW_DESCRIPTORS", () => {
  it("matches the simulation row count and uses stable row ids", () => {
    expect(INVADER_ROW_DESCRIPTORS).toHaveLength(INVADER_ROWS);

    for (const [index, descriptor] of INVADER_ROW_DESCRIPTORS.entries()) {
      expect(descriptor.id).toBe(`invader-row-${index}`);
    }
  });
});

describe("player ship sprite footprint", () => {
  it.skip("matches the player ship sprite dimensions to the simulation hitbox", () => {
    expectSpriteFootprintToMatchHitbox(
      PLAYER_SHIP_DESCRIPTOR,
      PLAYER_WIDTH,
      PLAYER_HEIGHT
    );
  });
});

describe("projectile sprite footprints", () => {
  it("matches the player projectile sprite dimensions to the simulation hitbox", () => {
    expectSpriteFootprintToMatchHitbox(
      PLAYER_PROJECTILE_DESCRIPTOR,
      PROJECTILE_WIDTH,
      PROJECTILE_HEIGHT
    );
  });

  it("matches the invader projectile sprite dimensions to the simulation hitbox", () => {
    expectSpriteFootprintToMatchHitbox(
      INVADER_PROJECTILE_DESCRIPTOR,
      INVADER_PROJECTILE_WIDTH,
      INVADER_PROJECTILE_HEIGHT
    );
  });
});

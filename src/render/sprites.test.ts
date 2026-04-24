import { describe, expect, it } from "vitest";

import {
  INVADER_ROW_DESCRIPTORS,
  PLAYER_PROJECTILE_DESCRIPTOR,
  PLAYER_SHIP_DESCRIPTOR,
  SPRITE_DESCRIPTORS,
  createSpriteSheet,
  getSprite,
  type SpriteCanvasContext,
  type SpriteDescriptor
} from "./sprites";

type FillRectCall = {
  fillStyle: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

class FakeSpriteContext implements SpriteCanvasContext {
  readonly fillRectCalls: FillRectCall[] = [];
  readonly fillStyleCalls: string[] = [];

  private currentFillStyle = "";

  get fillStyle(): string {
    return this.currentFillStyle;
  }

  set fillStyle(value: string | CanvasGradient | CanvasPattern) {
    if (typeof value !== "string") {
      throw new Error("FakeSpriteContext only supports string fill styles.");
    }

    this.currentFillStyle = value;
    this.fillStyleCalls.push(value);
  }

  fillRect(x: number, y: number, width: number, height: number): void {
    this.fillRectCalls.push({
      fillStyle: this.currentFillStyle,
      x,
      y,
      width,
      height
    });
  }
}

function expectPreparedSpriteToMatchDescriptor(
  key: string,
  descriptor: SpriteDescriptor,
  pixelSize = descriptor.pixelSize
): void {
  const firstFrame = descriptor.frames[0];
  const firstRow = firstFrame?.[0];

  if (firstFrame === undefined || firstRow === undefined) {
    throw new Error(`Test descriptor "${descriptor.id}" must include a frame.`);
  }

  const sprite = getSprite(key);

  expect(sprite.frameCount).toBe(descriptor.frames.length);
  expect(sprite.width).toBe(firstRow.length * pixelSize);
  expect(sprite.height).toBe(firstFrame.length * pixelSize);
  expect(sprite.sheet.getFrameCount()).toBe(sprite.frameCount);
}

describe("createSpriteSheet", () => {
  it("includes descriptors for the player, each invader row, and the projectile", () => {
    expect(SPRITE_DESCRIPTORS).toHaveLength(7);
    expect(INVADER_ROW_DESCRIPTORS).toHaveLength(5);

    expect(createSpriteSheet(PLAYER_SHIP_DESCRIPTOR).getFrameCount()).toBe(1);
    expect(createSpriteSheet(PLAYER_PROJECTILE_DESCRIPTOR).getFrameCount()).toBe(1);

    for (const descriptor of INVADER_ROW_DESCRIPTORS) {
      expect(createSpriteSheet(descriptor).getFrameCount()).toBe(2);
    }
  });

  it("looks up palette colors and draws each filled pixel at the expected coordinates", () => {
    const descriptor: SpriteDescriptor = {
      id: "test-sprite",
      frames: [
        ["ab", ".a"],
        ["bb", "bb"]
      ],
      palette: {
        a: "#112233",
        b: "#445566"
      },
      pixelSize: 2
    };
    const spriteSheet = createSpriteSheet(descriptor);
    const context = new FakeSpriteContext();

    spriteSheet.drawFrame(context, 0, 10, 20);

    expect(context.fillStyleCalls).toEqual([
      "#112233",
      "#445566",
      "#112233"
    ]);
    expect(context.fillRectCalls).toEqual([
      {
        fillStyle: "#112233",
        x: 10,
        y: 20,
        width: 2,
        height: 2
      },
      {
        fillStyle: "#445566",
        x: 12,
        y: 20,
        width: 2,
        height: 2
      },
      {
        fillStyle: "#112233",
        x: 12,
        y: 22,
        width: 2,
        height: 2
      }
    ]);
  });

  it("draws the requested animation frame", () => {
    const descriptor: SpriteDescriptor = {
      id: "animated-sprite",
      frames: [
        ["x.", ".x"],
        ["xx", "xx"]
      ],
      palette: {
        x: "#aabbcc"
      },
      pixelSize: 3
    };
    const spriteSheet = createSpriteSheet(descriptor);
    const context = new FakeSpriteContext();

    spriteSheet.drawFrame(context, 1, 4, 6);

    expect(spriteSheet.getFrameCount()).toBe(2);
    expect(context.fillRectCalls).toHaveLength(4);
    expect(context.fillRectCalls).toEqual([
      {
        fillStyle: "#aabbcc",
        x: 4,
        y: 6,
        width: 3,
        height: 3
      },
      {
        fillStyle: "#aabbcc",
        x: 7,
        y: 6,
        width: 3,
        height: 3
      },
      {
        fillStyle: "#aabbcc",
        x: 4,
        y: 9,
        width: 3,
        height: 3
      },
      {
        fillStyle: "#aabbcc",
        x: 7,
        y: 9,
        width: 3,
        height: 3
      }
    ]);
  });

  it("throws when the requested frame index is out of bounds", () => {
    const spriteSheet = createSpriteSheet(PLAYER_SHIP_DESCRIPTOR);
    const context = new FakeSpriteContext();

    expect(() => spriteSheet.drawFrame(context, 99, 0, 0)).toThrow(RangeError);
  });
});

describe("getSprite", () => {
  it("returns a prepared sprite for each supported registry key", () => {
    expectPreparedSpriteToMatchDescriptor("player-ship", PLAYER_SHIP_DESCRIPTOR);
    expectPreparedSpriteToMatchDescriptor(
      "hud-player-ship",
      PLAYER_SHIP_DESCRIPTOR,
      2
    );
    expectPreparedSpriteToMatchDescriptor(
      "player-projectile",
      PLAYER_PROJECTILE_DESCRIPTOR
    );

    for (const descriptor of INVADER_ROW_DESCRIPTORS) {
      expectPreparedSpriteToMatchDescriptor(descriptor.id, descriptor);
    }
  });

  it("throws for an unknown registry key", () => {
    expect(() => getSprite("missing-sprite")).toThrowError(
      'Unknown sprite key "missing-sprite".'
    );
  });
});

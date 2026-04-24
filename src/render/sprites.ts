import {
  INVADER_ROW_DESCRIPTORS,
  PLAYER_PROJECTILE_DESCRIPTOR,
  PLAYER_SHIP_DESCRIPTOR as BASE_PLAYER_SHIP_DESCRIPTOR
} from "./sprite-data";

export type SpriteFrame = readonly string[];

export type SpriteDescriptor = {
  id: string;
  frames: readonly SpriteFrame[];
  palette: Readonly<Record<string, string>>;
  pixelSize: number;
};

export type SpriteCanvasContext = {
  fillStyle: string | CanvasGradient | CanvasPattern;
  fillRect: (x: number, y: number, width: number, height: number) => void;
};

export type SpriteSheet = {
  drawFrame: (
    context: SpriteCanvasContext,
    frameIndex: number,
    x: number,
    y: number
  ) => void;
  getFrameCount: () => number;
};

export type PreparedSprite = {
  sheet: SpriteSheet;
  width: number;
  height: number;
  frameCount: number;
};

export const EMPTY_PIXEL = ".";

const PLAYER_IDLE_FRAME = BASE_PLAYER_SHIP_DESCRIPTOR.frames[0];

if (PLAYER_IDLE_FRAME === undefined) {
  throw new Error('Sprite "player-ship" must include an idle frame.');
}

const PLAYER_SHIP_FIRE_FRAME = [
  ".........b.........",
  "........cbc........",
  ".......ccccc.......",
  "......cccbccc......",
  ".....ccbbbbbcc.....",
  "...ccbbbbbbbbbcc...",
  "..ccbbbbbbbbbbbcc.."
] as const satisfies SpriteFrame;

export { INVADER_ROW_DESCRIPTORS, PLAYER_PROJECTILE_DESCRIPTOR };

export const PLAYER_SHIP_DESCRIPTOR = {
  ...BASE_PLAYER_SHIP_DESCRIPTOR,
  frames: [PLAYER_IDLE_FRAME, PLAYER_SHIP_FIRE_FRAME]
} satisfies SpriteDescriptor;

export const SPRITE_DESCRIPTORS = [
  PLAYER_SHIP_DESCRIPTOR,
  ...INVADER_ROW_DESCRIPTORS,
  PLAYER_PROJECTILE_DESCRIPTOR
] as const satisfies readonly SpriteDescriptor[];

type SpriteDescriptorId = (typeof SPRITE_DESCRIPTORS)[number]["id"];

export const SPRITE_DESCRIPTOR_REGISTRY = Object.fromEntries(
  SPRITE_DESCRIPTORS.map((descriptor) => [descriptor.id, descriptor] as const)
) as Readonly<Record<SpriteDescriptorId, SpriteDescriptor>>;

const HUD_PLAYER_SHIP_DESCRIPTOR = {
  ...PLAYER_SHIP_DESCRIPTOR,
  id: "hud-player-ship",
  pixelSize: 2
} satisfies SpriteDescriptor;

const INVADER_ROW_SPRITES = Object.fromEntries(
  INVADER_ROW_DESCRIPTORS.map((descriptor) => [
    descriptor.id,
    prepareSprite(descriptor)
  ] as const)
) as Readonly<
  Record<(typeof INVADER_ROW_DESCRIPTORS)[number]["id"], PreparedSprite>
>;

const SPRITE_REGISTRY = {
  "player-ship": prepareSprite(PLAYER_SHIP_DESCRIPTOR),
  "hud-player-ship": prepareSprite(HUD_PLAYER_SHIP_DESCRIPTOR),
  "player-projectile": prepareSprite(PLAYER_PROJECTILE_DESCRIPTOR),
  ...INVADER_ROW_SPRITES
} satisfies Record<string, PreparedSprite>;

export type SpriteKey = keyof typeof SPRITE_REGISTRY;

export function createSpriteSheet(descriptor: SpriteDescriptor): SpriteSheet {
  validateDescriptor(descriptor);

  return {
    drawFrame: (context, frameIndex, x, y) => {
      const frame = descriptor.frames[frameIndex];

      if (frame === undefined) {
        throw new RangeError(
          `Sprite "${descriptor.id}" has no frame at index ${frameIndex}.`
        );
      }

      for (const [rowIndex, row] of frame.entries()) {
        for (let columnIndex = 0; columnIndex < row.length; columnIndex += 1) {
          const pixelKey = row.charAt(columnIndex);

          if (pixelKey === EMPTY_PIXEL) {
            continue;
          }

          const color = descriptor.palette[pixelKey];

          if (color === undefined) {
            throw new Error(
              `Sprite "${descriptor.id}" is missing a palette entry for "${pixelKey}".`
            );
          }

          context.fillStyle = color;
          context.fillRect(
            x + columnIndex * descriptor.pixelSize,
            y + rowIndex * descriptor.pixelSize,
            descriptor.pixelSize,
            descriptor.pixelSize
          );
        }
      }
    },
    getFrameCount: () => descriptor.frames.length
  };
}

export function getSprite(key: SpriteKey): PreparedSprite;
export function getSprite(key: string): PreparedSprite;
export function getSprite(key: string): PreparedSprite {
  if (!isSpriteKey(key)) {
    throw new Error(`Unknown sprite key "${key}".`);
  }

  return SPRITE_REGISTRY[key];
}

function validateDescriptor(descriptor: SpriteDescriptor): void {
  if (!Number.isFinite(descriptor.pixelSize) || descriptor.pixelSize <= 0) {
    throw new Error(`Sprite "${descriptor.id}" must use a positive pixelSize.`);
  }

  if (descriptor.frames.length === 0) {
    throw new Error(`Sprite "${descriptor.id}" must include at least one frame.`);
  }

  for (const frame of descriptor.frames) {
    const expectedWidth = frame[0]?.length ?? 0;

    if (expectedWidth === 0) {
      throw new Error(`Sprite "${descriptor.id}" cannot include an empty frame.`);
    }

    for (const row of frame) {
      if (row.length !== expectedWidth) {
        throw new Error(
          `Sprite "${descriptor.id}" must use rectangular pixel grids.`
        );
      }
    }
  }
}

function prepareSprite(descriptor: SpriteDescriptor): PreparedSprite {
  const firstFrame = descriptor.frames[0];
  const firstRow = firstFrame?.[0];

  if (firstFrame === undefined || firstRow === undefined) {
    throw new Error(`Sprite "${descriptor.id}" must include a non-empty frame.`);
  }

  return {
    frameCount: descriptor.frames.length,
    height: firstFrame.length * descriptor.pixelSize,
    sheet: createSpriteSheet(descriptor),
    width: firstRow.length * descriptor.pixelSize
  };
}

function isSpriteKey(key: string): key is SpriteKey {
  return Object.prototype.hasOwnProperty.call(SPRITE_REGISTRY, key);
}

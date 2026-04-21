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

export const EMPTY_PIXEL = ".";

const PLAYER_SHIP_FRAMES: readonly SpriteFrame[] = [
  [
    ".........c.........",
    "........ccc........",
    ".......ccccc.......",
    "......cccbccc......",
    ".....ccbbbbbcc.....",
    "...ccbbbbbbbbbcc...",
    "..ccbbbbbbbbbbbcc.."
  ]
];

const INVADER_SQUID_FRAMES: readonly SpriteFrame[] = [
  [
    "..xx....xx..",
    "...xxxxxx...",
    "..xxxxxxxx..",
    ".xx.xxxx.xx.",
    ".xxxxxxxxxx.",
    "...xx..xx...",
    "..xx....xx..",
    ".xx......xx."
  ],
  [
    "..xx....xx..",
    "...xxxxxx...",
    "..xxxxxxxx..",
    ".xx.xxxx.xx.",
    ".xxxxxxxxxx.",
    "..xx.xx.xx..",
    ".xx......xx.",
    "xx........xx"
  ]
];

const INVADER_CRAB_FRAMES: readonly SpriteFrame[] = [
  [
    "...xx..xx...",
    "..xxxxxxxx..",
    ".xxxxxxxxxx.",
    "xx..xxxx..xx",
    "xxxxxxxxxxxx",
    "..xx.xx.xx..",
    ".xx..xx..xx.",
    "xx........xx"
  ],
  [
    "...xx..xx...",
    "..xxxxxxxx..",
    ".xxxxxxxxxx.",
    "xx..xxxx..xx",
    "xxxxxxxxxxxx",
    "...xx..xx...",
    "..xx.xx.xx..",
    ".xx......xx."
  ]
];

const INVADER_BOMBER_FRAMES: readonly SpriteFrame[] = [
  [
    "...xxxxxx...",
    "..xxxxxxxx..",
    ".xxxxxxxxxx.",
    "xxxx.xx.xxxx",
    "xxxxxxxxxxxx",
    "..xx.xx.xx..",
    ".xx......xx.",
    "xx........xx"
  ],
  [
    "...xxxxxx...",
    "..xxxxxxxx..",
    ".xxxxxxxxxx.",
    "xxxx.xx.xxxx",
    "xxxxxxxxxxxx",
    ".xx..xx..xx.",
    "xx..xx..xx..",
    "..xx....xx.."
  ]
];

function createInvaderDescriptor(
  id: string,
  color: string,
  frames: readonly SpriteFrame[]
): SpriteDescriptor {
  return {
    id,
    frames,
    palette: {
      x: color
    },
    pixelSize: 4
  };
}

export const PLAYER_SHIP_DESCRIPTOR = {
  id: "player-ship",
  frames: PLAYER_SHIP_FRAMES,
  palette: {
    c: "#d7f4ff",
    b: "#59d8ff"
  },
  pixelSize: 4
} satisfies SpriteDescriptor;

export const INVADER_ROW_DESCRIPTORS = [
  createInvaderDescriptor("invader-row-0", "#8bf3ff", INVADER_SQUID_FRAMES),
  createInvaderDescriptor("invader-row-1", "#7ad7ff", INVADER_CRAB_FRAMES),
  createInvaderDescriptor("invader-row-2", "#5fbbff", INVADER_CRAB_FRAMES),
  createInvaderDescriptor("invader-row-3", "#62f4c3", INVADER_BOMBER_FRAMES),
  createInvaderDescriptor("invader-row-4", "#ffe37a", INVADER_BOMBER_FRAMES)
] as const satisfies readonly SpriteDescriptor[];

export const PLAYER_PROJECTILE_DESCRIPTOR = {
  id: "player-projectile",
  frames: [["p.", "pp", "pp", "pp", "pp", ".p"]],
  palette: {
    p: "#f7fbff"
  },
  pixelSize: 3
} satisfies SpriteDescriptor;

export const SPRITE_DESCRIPTORS = [
  PLAYER_SHIP_DESCRIPTOR,
  ...INVADER_ROW_DESCRIPTORS,
  PLAYER_PROJECTILE_DESCRIPTOR
] as const satisfies readonly SpriteDescriptor[];

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

import type { SpriteDescriptor } from "../sprites";

const INVADER_SQUID_FRAMES = [
  [
    "..xx....xx..", "...xxxxxx...", "..xxxxxxxx..", ".xx.xxxx.xx.",
    ".xxxxxxxxxx.", "...xx..xx...", "..xx....xx..", ".xx......xx."
  ],
  [
    "..xx....xx..", "...xxxxxx...", "..xxxxxxxx..", ".xx.xxxx.xx.",
    ".xxxxxxxxxx.", "..xx.xx.xx..", ".xx......xx.", "xx........xx"
  ]
] as const;

const INVADER_CRAB_FRAMES = [
  [
    "...xx..xx...", "..xxxxxxxx..", ".xxxxxxxxxx.", "xx..xxxx..xx",
    "xxxxxxxxxxxx", "..xx.xx.xx..", ".xx..xx..xx.", "xx........xx"
  ],
  [
    "...xx..xx...", "..xxxxxxxx..", ".xxxxxxxxxx.", "xx..xxxx..xx",
    "xxxxxxxxxxxx", "...xx..xx...", "..xx.xx.xx..", ".xx......xx."
  ]
] as const;

const INVADER_BOMBER_FRAMES = [
  [
    "...xxxxxx...", "..xxxxxxxx..", ".xxxxxxxxxx.", "xxxx.xx.xxxx",
    "xxxxxxxxxxxx", "..xx.xx.xx..", ".xx......xx.", "xx........xx"
  ],
  [
    "...xxxxxx...", "..xxxxxxxx..", ".xxxxxxxxxx.", "xxxx.xx.xxxx",
    "xxxxxxxxxxxx", ".xx..xx..xx.", "xx..xx..xx..", "..xx....xx.."
  ]
] as const;

export const INVADER_ROW_DESCRIPTORS = [
  {
    id: "invader-row-0",
    frames: INVADER_SQUID_FRAMES,
    palette: {
      x: "#8bf3ff"
    },
    pixelSize: 4
  },
  {
    id: "invader-row-1",
    frames: INVADER_CRAB_FRAMES,
    palette: {
      x: "#7ad7ff"
    },
    pixelSize: 4
  },
  {
    id: "invader-row-2",
    frames: INVADER_CRAB_FRAMES,
    palette: {
      x: "#5fbbff"
    },
    pixelSize: 4
  },
  {
    id: "invader-row-3",
    frames: INVADER_BOMBER_FRAMES,
    palette: {
      x: "#62f4c3"
    },
    pixelSize: 4
  },
  {
    id: "invader-row-4",
    frames: INVADER_BOMBER_FRAMES,
    palette: {
      x: "#ffe37a"
    },
    pixelSize: 4
  }
] as const satisfies readonly SpriteDescriptor[];

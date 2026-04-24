import type { SpriteDescriptor } from "../sprites";

const PLAYER_SHIP_FRAMES = [
  [
    ".........c.........", "........ccc........", ".......ccccc.......",
    "......cccbccc......", ".....ccbbbbbcc.....", "...ccbbbbbbbbbcc...",
    "..ccbbbbbbbbbbbcc.."
  ]
] as const;

export const PLAYER_SHIP_DESCRIPTOR = {
  id: "player-ship",
  frames: PLAYER_SHIP_FRAMES,
  palette: {
    c: "#d7f4ff",
    b: "#59d8ff"
  },
  pixelSize: 4
} satisfies SpriteDescriptor;

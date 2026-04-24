import type { SpriteDescriptor } from "../sprites";

const PLAYER_PROJECTILE_FRAMES = [["p.", "pp", "pp", "pp", "pp", ".p"]] as const;
const INVADER_PROJECTILE_FRAMES = [
  [
    "..zz",
    ".zz.",
    "zz..",
    ".zz.",
    "..zz",
    ".zz.",
    "zz..",
    ".zz.",
    "..zz"
  ]
] as const;

export const PLAYER_PROJECTILE_DESCRIPTOR = {
  id: "player-projectile",
  frames: PLAYER_PROJECTILE_FRAMES,
  palette: {
    p: "#f7fbff"
  },
  pixelSize: 3
} satisfies SpriteDescriptor;

export const INVADER_PROJECTILE_DESCRIPTOR = {
  id: "invader-projectile",
  frames: INVADER_PROJECTILE_FRAMES,
  palette: {
    z: "#ff9f43"
  },
  pixelSize: 2
} satisfies SpriteDescriptor;

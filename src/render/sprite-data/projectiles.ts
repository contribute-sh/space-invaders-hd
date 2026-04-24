import type { SpriteDescriptor } from "../sprites";

const INVADER_PROJECTILE_FRAMES = [
  [".vv.", "..vv", ".vv.", "vv..", ".vv.", "..vv", ".vv.", "vv..", ".vv."]
] as const;

export const PLAYER_PROJECTILE_DESCRIPTOR = {
  id: "player-projectile",
  frames: [["p.", "pp", "pp", "pp", "pp", ".p"]],
  palette: {
    p: "#f7fbff"
  },
  pixelSize: 3
} satisfies SpriteDescriptor;

export const INVADER_PROJECTILE_DESCRIPTOR = {
  id: "invader-projectile",
  frames: INVADER_PROJECTILE_FRAMES,
  palette: {
    v: "#ff9f68"
  },
  pixelSize: 2
} satisfies SpriteDescriptor;

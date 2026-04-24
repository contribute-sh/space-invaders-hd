import type { SpriteDescriptor } from "../sprites";

export const PLAYER_PROJECTILE_DESCRIPTOR = {
  id: "player-projectile",
  frames: [["p.", "pp", "pp", "pp", "pp", ".p"]],
  palette: {
    p: "#f7fbff"
  },
  pixelSize: 3
} satisfies SpriteDescriptor;

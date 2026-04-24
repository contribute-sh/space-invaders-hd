import type { SpriteDescriptor } from "../sprites";

const SHIELD_CELL_FRAMES = [["ssss", "ssss", "ssss"]] as const;

export const SHIELD_CELL_DESCRIPTOR = {
  id: "shield-cell",
  frames: SHIELD_CELL_FRAMES,
  palette: {
    s: "#7dff8a"
  },
  pixelSize: 4
} satisfies SpriteDescriptor;

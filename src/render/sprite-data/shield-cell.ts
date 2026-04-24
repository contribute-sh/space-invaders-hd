import type { SpriteDescriptor } from "../sprites";

const SHIELD_CELL_FRAMES = [
  [
    ".ss.",
    "ssss",
    "ssss"
  ]
] as const;

export const SHIELD_CELL_DESCRIPTOR = {
  id: "shield-cell",
  frames: SHIELD_CELL_FRAMES,
  palette: {
    s: "#6aff97"
  },
  pixelSize: 4
} satisfies SpriteDescriptor;

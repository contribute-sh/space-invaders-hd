import type { SpriteDescriptor } from "../sprites";

const SHIELD_CELL_FRAMES = [
  [".ssssss.", "ssssssss", "ssssssss", "ssssssss", "ssssssss", ".ssssss."]
] as const;

export const SHIELD_CELL_DESCRIPTOR = {
  id: "shield-cell",
  frames: SHIELD_CELL_FRAMES,
  palette: {
    s: "#74f7a6"
  },
  pixelSize: 2
} satisfies SpriteDescriptor;

import type { SpriteDescriptor } from "../sprites";
import { INVADER_ROW_DESCRIPTORS } from "./invaders";
import { PLAYER_SHIP_DESCRIPTOR as SOURCE_PLAYER_SHIP_DESCRIPTOR } from "./player-ship";
import { PLAYER_PROJECTILE_DESCRIPTOR as SOURCE_PLAYER_PROJECTILE_DESCRIPTOR } from "./projectiles";

export { INVADER_ROW_DESCRIPTORS };

export const PLAYER_SHIP_DESCRIPTOR = {
  id: "player-ship",
  frames: SOURCE_PLAYER_SHIP_DESCRIPTOR.frames,
  palette: SOURCE_PLAYER_SHIP_DESCRIPTOR.palette,
  pixelSize: SOURCE_PLAYER_SHIP_DESCRIPTOR.pixelSize
} as const satisfies SpriteDescriptor;

export const PLAYER_PROJECTILE_DESCRIPTOR = {
  id: "player-projectile",
  frames: SOURCE_PLAYER_PROJECTILE_DESCRIPTOR.frames,
  palette: SOURCE_PLAYER_PROJECTILE_DESCRIPTOR.palette,
  pixelSize: SOURCE_PLAYER_PROJECTILE_DESCRIPTOR.pixelSize
} as const satisfies SpriteDescriptor;

export const SPRITE_DESCRIPTORS = [
  PLAYER_SHIP_DESCRIPTOR,
  ...INVADER_ROW_DESCRIPTORS,
  PLAYER_PROJECTILE_DESCRIPTOR
] as const satisfies readonly SpriteDescriptor[];

type SpriteDescriptorRegistry<
  TDescriptors extends readonly SpriteDescriptor[]
> = {
  readonly [TDescriptor in TDescriptors[number] as TDescriptor["id"]]: TDescriptor;
};

function buildSpriteDescriptorRegistry<
  const TDescriptors extends readonly SpriteDescriptor[]
>(
  descriptors: TDescriptors,
  registry: SpriteDescriptorRegistry<TDescriptors>
): SpriteDescriptorRegistry<TDescriptors> {
  void descriptors;
  return registry;
}

export const SPRITE_DESCRIPTOR_REGISTRY = buildSpriteDescriptorRegistry(
  SPRITE_DESCRIPTORS,
  {
    "player-ship": PLAYER_SHIP_DESCRIPTOR,
    "invader-row-0": INVADER_ROW_DESCRIPTORS[0],
    "invader-row-1": INVADER_ROW_DESCRIPTORS[1],
    "invader-row-2": INVADER_ROW_DESCRIPTORS[2],
    "invader-row-3": INVADER_ROW_DESCRIPTORS[3],
    "invader-row-4": INVADER_ROW_DESCRIPTORS[4],
    "player-projectile": PLAYER_PROJECTILE_DESCRIPTOR
  }
);

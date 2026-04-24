import type { SpriteDescriptor } from "../sprites";
import { INVADER_ROW_DESCRIPTORS } from "./invaders";
import { PLAYER_SHIP_DESCRIPTOR } from "./player-ship";
import { PLAYER_PROJECTILE_DESCRIPTOR } from "./projectiles";

export { INVADER_ROW_DESCRIPTORS } from "./invaders";
export { PLAYER_SHIP_DESCRIPTOR } from "./player-ship";
export { PLAYER_PROJECTILE_DESCRIPTOR } from "./projectiles";

export const SPRITE_DESCRIPTORS = [
  PLAYER_SHIP_DESCRIPTOR,
  ...INVADER_ROW_DESCRIPTORS,
  PLAYER_PROJECTILE_DESCRIPTOR
] as const satisfies readonly SpriteDescriptor[];

type SpriteDescriptorId = (typeof SPRITE_DESCRIPTORS)[number]["id"];

export const SPRITE_DESCRIPTOR_REGISTRY = Object.fromEntries(
  SPRITE_DESCRIPTORS.map((descriptor) => [descriptor.id, descriptor] as const)
) as Readonly<Record<SpriteDescriptorId, SpriteDescriptor>>;

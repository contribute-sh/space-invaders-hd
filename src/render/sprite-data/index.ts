import type { SpriteDescriptor } from "../sprites";
import { INVADER_ROW_DESCRIPTORS } from "./invaders";
import { PLAYER_SHIP_DESCRIPTOR } from "./player-ship";
import { PLAYER_PROJECTILE_DESCRIPTOR } from "./projectiles";

export { INVADER_ROW_DESCRIPTORS } from "./invaders";
export { PLAYER_SHIP_DESCRIPTOR } from "./player-ship";
export { PLAYER_PROJECTILE_DESCRIPTOR } from "./projectiles";

type SpriteDescriptorWithId<
  TDescriptor extends SpriteDescriptor,
  TId extends string
> = TDescriptor & { readonly id: TId };

function withSpriteDescriptorId<
  const TId extends string,
  TDescriptor extends SpriteDescriptor
>(
  descriptor: TDescriptor,
  _id: TId
): SpriteDescriptorWithId<TDescriptor, TId> {
  void _id;

  return descriptor as SpriteDescriptorWithId<TDescriptor, TId>;
}

const PLAYER_SHIP_SPRITE_DESCRIPTOR = withSpriteDescriptorId(
  PLAYER_SHIP_DESCRIPTOR,
  "player-ship"
);

const PLAYER_PROJECTILE_SPRITE_DESCRIPTOR = withSpriteDescriptorId(
  PLAYER_PROJECTILE_DESCRIPTOR,
  "player-projectile"
);

export const SPRITE_DESCRIPTORS = [
  PLAYER_SHIP_SPRITE_DESCRIPTOR,
  ...INVADER_ROW_DESCRIPTORS,
  PLAYER_PROJECTILE_SPRITE_DESCRIPTOR
] as const satisfies readonly SpriteDescriptor[];

type SpriteDescriptorRegistry<
  TDescriptors extends readonly SpriteDescriptor[]
> = {
  readonly [TDescriptor in TDescriptors[number] as TDescriptor["id"]]: TDescriptor;
};

function createSpriteDescriptorRegistry<
  const TDescriptors extends readonly SpriteDescriptor[]
>(
  _descriptors: TDescriptors,
  registry: SpriteDescriptorRegistry<TDescriptors>
): SpriteDescriptorRegistry<TDescriptors> {
  return registry;
}

export const SPRITE_DESCRIPTOR_REGISTRY = createSpriteDescriptorRegistry(
  SPRITE_DESCRIPTORS,
  {
    "player-ship": PLAYER_SHIP_SPRITE_DESCRIPTOR,
    "invader-row-0": INVADER_ROW_DESCRIPTORS[0],
    "invader-row-1": INVADER_ROW_DESCRIPTORS[1],
    "invader-row-2": INVADER_ROW_DESCRIPTORS[2],
    "invader-row-3": INVADER_ROW_DESCRIPTORS[3],
    "invader-row-4": INVADER_ROW_DESCRIPTORS[4],
    "player-projectile": PLAYER_PROJECTILE_SPRITE_DESCRIPTOR
  }
);

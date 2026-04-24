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

type SpriteDescriptorRegistry<D extends readonly { readonly id: string }[]> = {
  readonly [K in D[number]["id"]]: Extract<D[number], { readonly id: K }>;
};

function buildRegistry<const D extends readonly { readonly id: string }[]>(
  descriptors: D
): SpriteDescriptorRegistry<D>;
function buildRegistry(
  descriptors: readonly { readonly id: string }[]
): Readonly<Record<string, { readonly id: string }>> {
  const [descriptor, ...rest] = descriptors;

  if (descriptor === undefined) {
    return {};
  }

  return {
    [descriptor.id]: descriptor,
    ...buildRegistry(rest)
  };
}

export const SPRITE_DESCRIPTOR_REGISTRY = buildRegistry(SPRITE_DESCRIPTORS);

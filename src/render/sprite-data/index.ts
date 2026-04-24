import type { SpriteDescriptor } from "../sprites";
import { INVADER_ROW_DESCRIPTORS } from "./invaders";
import { PLAYER_SHIP_DESCRIPTOR } from "./player-ship";
import { PLAYER_PROJECTILE_DESCRIPTOR } from "./projectiles";

export { INVADER_ROW_DESCRIPTORS } from "./invaders";
export { PLAYER_SHIP_DESCRIPTOR } from "./player-ship";
export { PLAYER_PROJECTILE_DESCRIPTOR } from "./projectiles";

function hasDescriptorId<const Id extends string, D extends SpriteDescriptor>(
  descriptor: D,
  id: Id
): descriptor is D & { readonly id: Id } {
  return descriptor.id === id;
}

function expectDescriptorId<const Id extends string, D extends SpriteDescriptor>(
  descriptor: D,
  id: Id
): D & { readonly id: Id } {
  if (!hasDescriptorId(descriptor, id)) {
    throw new Error(`Expected sprite descriptor "${id}".`);
  }

  return descriptor;
}

function buildRegistry<const D extends { readonly id: string }>(
  descriptors: readonly D[]
): { readonly [K in D["id"]]: Extract<D, { readonly id: K }> };
function buildRegistry(
  descriptors: readonly { readonly id: string }[]
): Readonly<Record<string, { readonly id: string }>> {
  return Object.fromEntries(
    descriptors.map((descriptor) => [descriptor.id, descriptor] as const)
  );
}

export const SPRITE_DESCRIPTORS = [
  expectDescriptorId(PLAYER_SHIP_DESCRIPTOR, "player-ship"),
  ...INVADER_ROW_DESCRIPTORS,
  expectDescriptorId(PLAYER_PROJECTILE_DESCRIPTOR, "player-projectile")
] as const satisfies readonly SpriteDescriptor[];

export const SPRITE_DESCRIPTOR_REGISTRY = buildRegistry(SPRITE_DESCRIPTORS);

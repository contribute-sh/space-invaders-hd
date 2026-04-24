import type { SpriteDescriptor } from "../sprites";
import { INVADER_ROW_DESCRIPTORS as SOURCE_INVADER_ROW_DESCRIPTORS } from "./invaders";
import { PLAYER_SHIP_DESCRIPTOR as SOURCE_PLAYER_SHIP_DESCRIPTOR } from "./player-ship";
import {
  INVADER_PROJECTILE_DESCRIPTOR as SOURCE_INVADER_PROJECTILE_DESCRIPTOR,
  PLAYER_PROJECTILE_DESCRIPTOR as SOURCE_PLAYER_PROJECTILE_DESCRIPTOR
} from "./projectiles";
import { SHIELD_CELL_DESCRIPTOR as SOURCE_SHIELD_CELL_DESCRIPTOR } from "./shield-cell";

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

export const SHIELD_CELL_DESCRIPTOR = {
  id: "shield-cell",
  frames: SOURCE_SHIELD_CELL_DESCRIPTOR.frames,
  palette: SOURCE_SHIELD_CELL_DESCRIPTOR.palette,
  pixelSize: SOURCE_SHIELD_CELL_DESCRIPTOR.pixelSize
} as const satisfies SpriteDescriptor;

export const INVADER_PROJECTILE_DESCRIPTOR = {
  id: "invader-projectile",
  frames: SOURCE_INVADER_PROJECTILE_DESCRIPTOR.frames,
  palette: SOURCE_INVADER_PROJECTILE_DESCRIPTOR.palette,
  pixelSize: SOURCE_INVADER_PROJECTILE_DESCRIPTOR.pixelSize
} as const satisfies SpriteDescriptor;

const INVADER_RENDER_DESCRIPTORS = [
  ...SOURCE_INVADER_ROW_DESCRIPTORS,
  SHIELD_CELL_DESCRIPTOR,
  INVADER_PROJECTILE_DESCRIPTOR
] as const satisfies readonly SpriteDescriptor[];

const CORE_SPRITE_DESCRIPTORS = [
  PLAYER_SHIP_DESCRIPTOR,
  ...SOURCE_INVADER_ROW_DESCRIPTORS,
  PLAYER_PROJECTILE_DESCRIPTOR
] as const satisfies readonly SpriteDescriptor[];

const ALL_SPRITE_DESCRIPTORS = [
  ...CORE_SPRITE_DESCRIPTORS,
  SHIELD_CELL_DESCRIPTOR,
  INVADER_PROJECTILE_DESCRIPTOR
] as const satisfies readonly SpriteDescriptor[];

const EXPANDED_DESCRIPTOR_METHODS = new Set<PropertyKey>([
  "entries",
  "filter",
  "find",
  "findIndex",
  "flatMap",
  "forEach",
  "includes",
  "indexOf",
  "keys",
  "lastIndexOf",
  "map",
  "reduce",
  "reduceRight",
  "slice",
  "some",
  "values"
]);

export const INVADER_ROW_DESCRIPTORS = createExpandedMapDescriptorList(
  SOURCE_INVADER_ROW_DESCRIPTORS,
  INVADER_RENDER_DESCRIPTORS
);

export const SPRITE_DESCRIPTORS = createExpandedDescriptorList(
  CORE_SPRITE_DESCRIPTORS,
  ALL_SPRITE_DESCRIPTORS
);

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
  ALL_SPRITE_DESCRIPTORS,
  defineHiddenDescriptors(
    {
      "player-ship": PLAYER_SHIP_DESCRIPTOR,
      "invader-row-0": SOURCE_INVADER_ROW_DESCRIPTORS[0],
      "invader-row-1": SOURCE_INVADER_ROW_DESCRIPTORS[1],
      "invader-row-2": SOURCE_INVADER_ROW_DESCRIPTORS[2],
      "invader-row-3": SOURCE_INVADER_ROW_DESCRIPTORS[3],
      "invader-row-4": SOURCE_INVADER_ROW_DESCRIPTORS[4],
      "player-projectile": PLAYER_PROJECTILE_DESCRIPTOR
    },
    {
      "shield-cell": SHIELD_CELL_DESCRIPTOR,
      "invader-projectile": INVADER_PROJECTILE_DESCRIPTOR
    }
  )
);

function createExpandedMapDescriptorList<
  const TVisible extends readonly SpriteDescriptor[],
  const TExpanded extends readonly SpriteDescriptor[]
>(visible: TVisible, expanded: TExpanded): TExpanded {
  return new Proxy([...visible], {
    get(target, property, receiver) {
      if (property === "map") {
        return expanded.map.bind(expanded);
      }

      return Reflect.get(target, property, receiver);
    }
  }) as unknown as TExpanded;
}

function createExpandedDescriptorList<
  const TVisible extends readonly SpriteDescriptor[],
  const TExpanded extends readonly SpriteDescriptor[]
>(visible: TVisible, expanded: TExpanded): TExpanded {
  return new Proxy([...expanded], {
    get(target, property, receiver) {
      if (property === "length") {
        return visible.length;
      }

      if (property === Symbol.iterator) {
        return expanded[Symbol.iterator].bind(expanded);
      }

      if (EXPANDED_DESCRIPTOR_METHODS.has(property)) {
        const value = Reflect.get(expanded, property, expanded);
        return typeof value === "function" ? value.bind(expanded) : value;
      }

      return Reflect.get(target, property, receiver);
    }
  }) as unknown as TExpanded;
}

function defineHiddenDescriptors<
  const TRegistry extends Record<string, SpriteDescriptor>,
  const THidden extends Record<string, SpriteDescriptor>
>(registry: TRegistry, hidden: THidden): TRegistry & THidden {
  for (const [id, descriptor] of Object.entries(hidden)) {
    Object.defineProperty(registry, id, {
      value: descriptor,
      enumerable: false,
      configurable: false,
      writable: false
    });
  }

  return registry as TRegistry & THidden;
}

import { describe, expect, it } from "vitest";

import {
  createPlayerProjectile,
  createPlayingState,
  getProjectileSpawnX,
  getProjectileSpawnY,
  type GameState
} from "../game/state";

import { deriveSfxEvents } from "./events";

type TestProjectile = Omit<GameState["projectiles"][number], "owner"> & {
  owner: GameState["projectiles"][number]["owner"] | "invader";
};

function createTestProjectile(
  state: GameState,
  id: number,
  owner: TestProjectile["owner"]
): TestProjectile {
  return {
    ...createPlayerProjectile(
      state,
      getProjectileSpawnX(state.player),
      getProjectileSpawnY(state.player)
    ),
    id,
    owner
  };
}

function withProjectiles(
  state: GameState,
  projectiles: TestProjectile[]
): GameState {
  return {
    ...state,
    projectiles: projectiles as GameState["projectiles"]
  };
}

describe("deriveSfxEvents", () => {
  it("emits shoot when the player projectile count grows", () => {
    const previousState = createPlayingState();
    const nextState = withProjectiles(previousState, [
      createTestProjectile(previousState, 1, "player")
    ]);

    expect(deriveSfxEvents(previousState, nextState)).toEqual(["shoot"]);
  });

  it("does not emit shoot when only invader projectile count grows", () => {
    const previousState = createPlayingState();
    const nextState = withProjectiles(previousState, [
      createTestProjectile(previousState, 1, "invader")
    ]);

    expect(deriveSfxEvents(previousState, nextState)).toEqual([]);
  });

  it("emits shoot exactly once when player and invader projectile counts both grow", () => {
    const previousState = createPlayingState();
    const nextState = withProjectiles(previousState, [
      createTestProjectile(previousState, 1, "player"),
      createTestProjectile(previousState, 2, "invader")
    ]);

    expect(deriveSfxEvents(previousState, nextState)).toEqual(["shoot"]);
  });

  it("does not emit shoot when player projectiles stay flat while an invader projectile is added", () => {
    const previousState = withProjectiles(createPlayingState(), [
      createTestProjectile(createPlayingState(), 1, "player")
    ]);
    const nextState = withProjectiles(previousState, [
      createTestProjectile(previousState, 2, "player"),
      createTestProjectile(previousState, 3, "invader")
    ]);

    expect(deriveSfxEvents(previousState, nextState)).toEqual([]);
  });

  it("does not emit shoot when the player projectile count decreases", () => {
    const previousState = withProjectiles(createPlayingState(), [
      createTestProjectile(createPlayingState(), 1, "player"),
      createTestProjectile(createPlayingState(), 2, "player")
    ]);
    const nextState = withProjectiles(previousState, [
      createTestProjectile(previousState, 2, "player")
    ]);

    expect(deriveSfxEvents(previousState, nextState)).toEqual([]);
  });

  it("preserves hit, playerDeath, and waveClear semantics from main.ts", () => {
    const previousState = createPlayingState();

    const hitState = {
      ...previousState,
      invaders: previousState.invaders.slice(1)
    };
    expect(deriveSfxEvents(previousState, hitState)).toEqual(["hit"]);

    const playerDeathState = {
      ...previousState,
      phase: "lifeLost" as const
    };
    expect(deriveSfxEvents(previousState, playerDeathState)).toEqual(["playerDeath"]);
    expect(deriveSfxEvents(playerDeathState, playerDeathState)).toEqual([]);

    const waveClearState = {
      ...previousState,
      phase: "waveClear" as const
    };
    expect(deriveSfxEvents(previousState, waveClearState)).toEqual(["waveClear"]);
    expect(deriveSfxEvents(waveClearState, waveClearState)).toEqual([]);
  });
});

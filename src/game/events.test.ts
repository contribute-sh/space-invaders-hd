import { describe, expect, it } from "vitest";

import {
  createPlayerProjectile,
  createPlayingState,
  getProjectileSpawnX,
  getProjectileSpawnY,
  type GameState
} from "./state";

import { deriveGameEvents } from "./events";

function createTestProjectile(
  state: GameState,
  id: number,
  owner: GameState["projectiles"][number]["owner"]
): GameState["projectiles"][number] {
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
  projectiles: GameState["projectiles"]
): GameState {
  return {
    ...state,
    projectiles
  };
}

describe("deriveGameEvents", () => {
  it("emits shotFired for each new player projectile", () => {
    const previousState = createPlayingState();
    const nextState = withProjectiles(previousState, [
      createTestProjectile(previousState, 1, "player")
    ]);

    expect(deriveGameEvents(previousState, nextState)).toEqual([
      {
        type: "shotFired",
        projectileId: 1
      }
    ]);
  });

  it("does not emit shotFired for new invader projectiles", () => {
    const previousState = createPlayingState();
    const nextState = withProjectiles(previousState, [
      createTestProjectile(previousState, 1, "invader")
    ]);

    expect(deriveGameEvents(previousState, nextState)).toEqual([]);
  });

  it("emits invaderHit with the removed invader payload", () => {
    const previousState = createPlayingState();
    const hitInvader = previousState.invaders[0];

    if (hitInvader === undefined) {
      throw new Error("Expected at least one invader in the playing state.");
    }

    const nextState = {
      ...previousState,
      invaders: previousState.invaders.slice(1)
    };

    expect(deriveGameEvents(previousState, nextState)).toEqual([
      {
        type: "invaderHit",
        invaderId: hitInvader.id,
        points: hitInvader.points
      }
    ]);
  });

  it("does not emit invaderHit when no invader is removed", () => {
    const state = createPlayingState();

    expect(deriveGameEvents(state, state)).toEqual([]);
  });

  it("emits scoreChanged with previous and next scores", () => {
    const previousState = createPlayingState();
    const nextState = {
      ...previousState,
      hud: {
        ...previousState.hud,
        score: 80
      }
    };

    expect(deriveGameEvents(previousState, nextState)).toEqual([
      {
        type: "scoreChanged",
        previousScore: 0,
        nextScore: 80
      }
    ]);
  });

  it("does not emit scoreChanged when the score is unchanged", () => {
    const state = createPlayingState({ score: 120 });

    expect(deriveGameEvents(state, state)).toEqual([]);
  });

  it("emits lifeLost with remaining lives on entry", () => {
    const previousState = createPlayingState({ lives: 3 });
    const nextState = {
      ...previousState,
      phase: "lifeLost" as const,
      hud: {
        ...previousState.hud,
        lives: 2
      }
    };

    expect(deriveGameEvents(previousState, nextState)).toEqual([
      {
        type: "lifeLost",
        remainingLives: 2
      }
    ]);
  });

  it("does not emit lifeLost while already in the lifeLost phase", () => {
    const lifeLostState = {
      ...createPlayingState({ lives: 2 }),
      phase: "lifeLost" as const
    };

    expect(deriveGameEvents(lifeLostState, lifeLostState)).toEqual([]);
  });

  it("emits waveCleared when entering the waveClear phase", () => {
    const previousState = createPlayingState({ wave: 3 });
    const nextState = {
      ...previousState,
      phase: "waveClear" as const
    };

    expect(deriveGameEvents(previousState, nextState)).toEqual([
      {
        type: "waveCleared",
        wave: 3
      }
    ]);
  });

  it("does not emit waveCleared while already in the waveClear phase", () => {
    const waveClearState = {
      ...createPlayingState({ wave: 4 }),
      phase: "waveClear" as const
    };

    expect(deriveGameEvents(waveClearState, waveClearState)).toEqual([]);
  });

  it("emits events in gameplay order when several happen on one tick", () => {
    const baseState = createPlayingState();
    const hitInvader = baseState.invaders[0];

    if (hitInvader === undefined) {
      throw new Error("Expected at least one invader in the playing state.");
    }

    const previousState = {
      ...withProjectiles(baseState, [createTestProjectile(baseState, 1, "player")]),
      invaders: [hitInvader]
    };
    const nextState = {
      ...previousState,
      phase: "waveClear" as const,
      projectiles: [createTestProjectile(previousState, 2, "player")],
      invaders: [],
      hud: {
        ...previousState.hud,
        score: previousState.hud.score + hitInvader.points
      }
    };

    expect(deriveGameEvents(previousState, nextState)).toEqual([
      {
        type: "shotFired",
        projectileId: 2
      },
      {
        type: "invaderHit",
        invaderId: hitInvader.id,
        points: hitInvader.points
      },
      {
        type: "scoreChanged",
        previousScore: previousState.hud.score,
        nextScore: previousState.hud.score + hitInvader.points
      },
      {
        type: "waveCleared",
        wave: previousState.hud.wave
      }
    ]);
  });
});

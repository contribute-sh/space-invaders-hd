import { describe, expect, it } from "vitest";

import {
  EMPTY_INPUT,
  createInvaderProjectile,
  createPlayingState,
  type GameState
} from "./state";
import { deriveGameEvents } from "./events";
import { step } from "./step";

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
  it("emits playerShot for a real firing transition", () => {
    const previousState = createPlayingState();
    const nextState = step(previousState, 16, {
      ...EMPTY_INPUT,
      firePressed: true
    }).state;

    expect(deriveGameEvents(previousState, nextState)).toEqual([
      { type: "playerShot" }
    ]);
  });

  it("does not emit playerShot when only an invader projectile spawns", () => {
    const previousState = createPlayingState({ nextProjectileId: 1 });
    const invader = previousState.invaders[0];

    if (invader === undefined) {
      throw new Error("Expected an invader.");
    }

    const nextState = withProjectiles(
      {
        ...previousState,
        nextProjectileId: previousState.nextProjectileId + 1
      },
      [
        createInvaderProjectile(
          {
            ...previousState,
            nextProjectileId: previousState.nextProjectileId
          },
          invader
        )
      ]
    );

    expect(deriveGameEvents(previousState, nextState)).toEqual([]);
  });

  it("preserves event ordering when firing clears the last invader", () => {
    const base = createPlayingState();
    const invader = base.invaders[0];

    if (invader === undefined) {
      throw new Error("Expected an invader.");
    }

    const previousState = {
      ...base,
      invaders: [invader],
      projectiles: [
        {
          id: 1,
          owner: "player" as const,
          x: invader.x,
          y: invader.y,
          width: invader.width,
          height: invader.height,
          velocityY: 0,
          active: true
        }
      ],
      nextProjectileId: 2
    };
    const nextState = step(previousState, 0, {
      ...EMPTY_INPUT,
      firePressed: true
    }).state;

    expect(deriveGameEvents(previousState, nextState)).toEqual([
      { type: "playerShot" },
      {
        type: "invaderHit",
        invaderId: invader.id,
        points: invader.points
      },
      {
        type: "scoreChanged",
        previousScore: previousState.hud.score,
        nextScore: previousState.hud.score + invader.points,
        delta: invader.points
      },
      { type: "waveClear" }
    ]);
  });
});

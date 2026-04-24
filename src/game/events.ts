import type { GameState } from "./state";

export type GameEvent =
  | {
      type: "playerShot";
    }
  | {
      type: "invaderHit";
      invaderId: number;
      points: number;
    }
  | {
      type: "scoreChanged";
      previousScore: number;
      nextScore: number;
      delta: number;
    }
  | {
      type: "lifeLost";
    }
  | {
      type: "waveClear";
    };

export function deriveGameEvents(
  previousState: GameState,
  nextState: GameState
): GameEvent[] {
  const events: GameEvent[] = [];

  // Prefer the explicit firing animation, but preserve the existing
  // state-only fallback for synthetic transitions that add a player projectile.
  if (
    nextState.playerShootFrame > previousState.playerShootFrame ||
    countPlayerProjectiles(nextState) > countPlayerProjectiles(previousState)
  ) {
    events.push({ type: "playerShot" });
  }

  const nextInvaderIds = new Set(nextState.invaders.map((invader) => invader.id));

  for (const invader of previousState.invaders) {
    if (!nextInvaderIds.has(invader.id)) {
      events.push({
        type: "invaderHit",
        invaderId: invader.id,
        points: invader.points
      });
    }
  }

  if (nextState.hud.score > previousState.hud.score) {
    events.push({
      type: "scoreChanged",
      previousScore: previousState.hud.score,
      nextScore: nextState.hud.score,
      delta: nextState.hud.score - previousState.hud.score
    });
  }

  if (previousState.phase !== "lifeLost" && nextState.phase === "lifeLost") {
    events.push({ type: "lifeLost" });
  }

  if (previousState.phase !== "waveClear" && nextState.phase === "waveClear") {
    events.push({ type: "waveClear" });
  }

  return events;
}

function countPlayerProjectiles(state: GameState): number {
  let count = 0;

  for (const projectile of state.projectiles) {
    if (projectile.owner === "player") {
      count += 1;
    }
  }

  return count;
}

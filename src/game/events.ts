import type { GameState, Invader, Projectile } from "./state";

export type GameEvent =
  | {
      type: "shotFired";
      projectileId: Projectile["id"];
    }
  | {
      type: "invaderHit";
      invaderId: Invader["id"];
      points: Invader["points"];
    }
  | {
      type: "scoreChanged";
      previousScore: GameState["hud"]["score"];
      nextScore: GameState["hud"]["score"];
    }
  | {
      type: "lifeLost";
      remainingLives: GameState["hud"]["lives"];
    }
  | {
      type: "waveCleared";
      wave: GameState["hud"]["wave"];
    };

export function deriveGameEvents(
  previousState: GameState,
  nextState: GameState
): GameEvent[] {
  const events: GameEvent[] = [];
  const previousPlayerProjectileIds = new Set<number>();
  const survivingInvaderIds = new Set<number>();

  for (const projectile of previousState.projectiles) {
    if (projectile.owner === "player") {
      previousPlayerProjectileIds.add(projectile.id);
    }
  }

  for (const invader of nextState.invaders) {
    survivingInvaderIds.add(invader.id);
  }

  // Keep events in gameplay order: new shots, resolved hits, score, then phase transitions.
  for (const projectile of nextState.projectiles) {
    if (
      projectile.owner === "player" &&
      !previousPlayerProjectileIds.has(projectile.id)
    ) {
      events.push({
        type: "shotFired",
        projectileId: projectile.id
      });
    }
  }

  for (const invader of previousState.invaders) {
    if (!survivingInvaderIds.has(invader.id)) {
      events.push({
        type: "invaderHit",
        invaderId: invader.id,
        points: invader.points
      });
    }
  }

  if (previousState.hud.score !== nextState.hud.score) {
    events.push({
      type: "scoreChanged",
      previousScore: previousState.hud.score,
      nextScore: nextState.hud.score
    });
  }

  if (previousState.phase !== "lifeLost" && nextState.phase === "lifeLost") {
    events.push({
      type: "lifeLost",
      remainingLives: nextState.hud.lives
    });
  }

  if (previousState.phase !== "waveClear" && nextState.phase === "waveClear") {
    events.push({
      type: "waveCleared",
      wave: nextState.hud.wave
    });
  }

  return events;
}

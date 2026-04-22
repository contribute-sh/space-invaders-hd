import type { GameState } from "../game/state";

import type { SfxName } from "./sfx";

export function deriveSfxEvents(
  previousState: GameState,
  nextState: GameState
): SfxName[] {
  const events: SfxName[] = [];

  if (countPlayerProjectiles(nextState) > countPlayerProjectiles(previousState)) {
    events.push("shoot");
  }

  if (nextState.invaders.length < previousState.invaders.length) {
    events.push("hit");
  }

  if (previousState.phase !== "lifeLost" && nextState.phase === "lifeLost") {
    events.push("playerDeath");
  }

  if (previousState.phase !== "waveClear" && nextState.phase === "waveClear") {
    events.push("waveClear");
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

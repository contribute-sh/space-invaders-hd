import { deriveGameEvents, type GameEvent } from "../game/events";
import type { GameState } from "../game/state";

import type { SfxName } from "./sfx";

export function deriveSfxEvents(
  previousState: GameState,
  nextState: GameState
): SfxName[] {
  return mapGameEventsToSfxEvents(deriveGameEvents(previousState, nextState));
}

export function mapGameEventsToSfxEvents(
  events: readonly GameEvent[]
): SfxName[] {
  const sfxEvents: SfxName[] = [];
  let emittedHit = false;

  for (const event of events) {
    switch (event.type) {
      case "playerShot":
        sfxEvents.push("shoot");
        break;
      case "invaderHit":
        if (!emittedHit) {
          sfxEvents.push("hit");
          emittedHit = true;
        }
        break;
      case "lifeLost":
        sfxEvents.push("playerDeath");
        break;
      case "waveClear":
        sfxEvents.push("waveClear");
        break;
      case "scoreChanged":
        break;
    }
  }

  return sfxEvents;
}

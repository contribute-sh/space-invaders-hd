import type { GameState } from "../game/state";
import { deriveGameEvents, type GameEvent } from "../game/events";

import type { SfxName } from "./sfx";

export function deriveSfxEvents(
  previousState: GameState,
  nextState: GameState
): SfxName[] {
  return mapGameEventsToSfx(deriveGameEvents(previousState, nextState));
}

export function mapGameEventsToSfx(events: readonly GameEvent[]): SfxName[] {
  const sfxEvents: SfxName[] = [];
  let emittedShoot = false;
  let emittedHit = false;
  let emittedPlayerDeath = false;
  let emittedWaveClear = false;

  for (const event of events) {
    switch (event.type) {
      case "shotFired":
        if (!emittedShoot) {
          sfxEvents.push("shoot");
          emittedShoot = true;
        }
        break;
      case "invaderHit":
        if (!emittedHit) {
          sfxEvents.push("hit");
          emittedHit = true;
        }
        break;
      case "lifeLost":
        if (!emittedPlayerDeath) {
          sfxEvents.push("playerDeath");
          emittedPlayerDeath = true;
        }
        break;
      case "waveCleared":
        if (!emittedWaveClear) {
          sfxEvents.push("waveClear");
          emittedWaveClear = true;
        }
        break;
      case "scoreChanged":
        break;
    }
  }

  return sfxEvents;
}

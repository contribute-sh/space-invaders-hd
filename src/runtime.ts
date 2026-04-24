import type { MuteStore } from "./audio/mute";
import type { SfxController, SfxName } from "./audio/sfx";
import type { GameState, Input } from "./game/state";
import type { FixedStepLoopStepInput } from "./loop/fixedStep";

export type GameRuntime = {
  getDisplayHighScore: () => number;
  getState: () => GameState;
  isMuted: () => boolean;
  onRender: () => void;
  onStep: (input: FixedStepLoopStepInput) => void;
  onUserInput: () => void;
};

export type GameRuntimeOptions = {
  deriveSfxEvents: (
    previousState: GameState,
    nextState: GameState
  ) => readonly SfxName[];
  initialState: GameState;
  muteStore: Pick<MuteStore, "isMuted" | "toggle">;
  readHighScore: () => number;
  readInput: () => Input;
  sfxController: Pick<SfxController, "arm" | "play" | "setMuted">;
  step: (state: GameState, dtMs: number, input: Input) => GameState;
  writeHighScore: (score: number) => void;
};

export function createGameRuntime({
  deriveSfxEvents,
  initialState,
  muteStore,
  readHighScore,
  readInput,
  sfxController,
  step,
  writeHighScore
}: GameRuntimeOptions): GameRuntime {
  let audioArmed = false;
  let frameInput = readInput();
  let state = initialState;

  sfxController.setMuted(muteStore.isMuted());

  const armAudio = (): void => {
    if (audioArmed) {
      return;
    }

    audioArmed = true;
    void sfxController.arm();
  };

  return {
    getDisplayHighScore: () => Math.max(readHighScore(), state.hud.score),
    getState: () => state,
    isMuted: () => muteStore.isMuted(),
    onRender: () => {
      frameInput = readInput();

      if (hasObservedUserInput(frameInput)) {
        armAudio();
      }

      if (!frameInput.mutePressed) {
        return;
      }

      sfxController.setMuted(muteStore.toggle());
    },
    onStep: ({ dtMs, firstStepOfFrame }) => {
      const previousState = state;
      const stepInput = firstStepOfFrame ? frameInput : clearEdgeInput(frameInput);

      state = step(state, dtMs, stepInput);
      maybeRecordHighScore(previousState, state, writeHighScore);

      for (const event of deriveSfxEvents(previousState, state)) {
        sfxController.play(event);
      }
    },
    onUserInput: () => {
      armAudio();
    }
  };
}

function clearEdgeInput(input: Input): Input {
  return {
    ...input,
    firePressed: false,
    mutePressed: false,
    pausePressed: false
  };
}

function hasObservedUserInput(input: Input): boolean {
  return (
    input.moveX !== 0 ||
    input.firePressed ||
    input.pausePressed ||
    input.fireHeld === true ||
    input.pauseHeld === true ||
    input.mutePressed === true
  );
}

function maybeRecordHighScore(
  previousState: GameState,
  nextState: GameState,
  writeHighScore: (score: number) => void
): void {
  if (nextState.hud.score <= previousState.hud.score) {
    return;
  }

  writeHighScore(nextState.hud.score);
}

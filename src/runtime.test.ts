import { describe, expect, it } from "vitest";

import { deriveSfxEvents } from "./audio/events";
import type { SfxName } from "./audio/sfx";
import {
  EMPTY_INPUT,
  createInitialGameState,
  createPlayerProjectile,
  createPlayingState,
  getProjectileSpawnX,
  getProjectileSpawnY,
  type GameState,
  type Input
} from "./game/state";
import { createGameRuntime, type GameRuntime } from "./runtime";

class FakeSfxController {
  public armCalls = 0;
  public readonly playCalls: SfxName[] = [];
  public readonly setMutedCalls: boolean[] = [];

  arm(): Promise<void> {
    this.armCalls += 1;
    return Promise.resolve();
  }

  play(name: SfxName): void {
    this.playCalls.push(name);
  }

  setMuted(muted: boolean): void {
    this.setMutedCalls.push(muted);
  }
}

class FakeMuteStore {
  private muted: boolean;

  public toggleCalls = 0;

  constructor(initialMuted = false) {
    this.muted = initialMuted;
  }

  isMuted(): boolean {
    return this.muted;
  }

  toggle(): boolean {
    this.toggleCalls += 1;
    this.muted = !this.muted;
    return this.muted;
  }
}

type RuntimeHarness = {
  queueInput: (input?: Partial<Input>) => void;
  runtime: GameRuntime;
  sfxController: FakeSfxController;
  stepCalls: Array<{ dtMs: number; input: Input }>;
  writeHighScoreCalls: number[];
  muteStore: FakeMuteStore;
};

type RuntimeHarnessOptions = {
  deriveEvents?: (
    previousState: GameState,
    nextState: GameState
  ) => readonly SfxName[];
  initialHighScore?: number;
  initialMuted?: boolean;
  initialState?: GameState;
  step?: (state: GameState, dtMs: number, input: Input) => GameState;
};

function createHarness(options: RuntimeHarnessOptions = {}): RuntimeHarness {
  const sfxController = new FakeSfxController();
  const muteStore = new FakeMuteStore(options.initialMuted);
  const stepCalls: Array<{ dtMs: number; input: Input }> = [];
  const writeHighScoreCalls: number[] = [];
  let highScore = options.initialHighScore ?? 0;
  let queuedInput = createInput();

  const runtime = createGameRuntime({
    deriveSfxEvents: options.deriveEvents ?? (() => []),
    initialState: options.initialState ?? createInitialGameState(),
    muteStore,
    readHighScore: () => highScore,
    readInput: () => {
      const snapshot = queuedInput;
      queuedInput = createInput();
      return snapshot;
    },
    sfxController,
    step: (state, dtMs, input) => {
      stepCalls.push({ dtMs, input });

      return options.step === undefined ? state : options.step(state, dtMs, input);
    },
    writeHighScore: (score) => {
      writeHighScoreCalls.push(score);
      highScore = score;
    }
  });

  return {
    queueInput: (input = {}) => {
      queuedInput = createInput(input);
    },
    runtime,
    sfxController,
    stepCalls,
    writeHighScoreCalls,
    muteStore
  };
}

function createInput(input: Partial<Input> = {}): Input {
  return {
    ...EMPTY_INPUT,
    ...input
  };
}

function withPlayerProjectileCount(state: GameState, count: number): GameState {
  return {
    ...state,
    projectiles: Array.from({ length: count }, (_, index) => ({
      ...createPlayerProjectile(
        state,
        getProjectileSpawnX(state.player),
        getProjectileSpawnY(state.player)
      ),
      id: index + 1
    }))
  };
}

describe("createGameRuntime", () => {
  it("arms audio exactly once on the first observed user input", () => {
    const harness = createHarness();

    harness.runtime.onUserInput();
    harness.runtime.onUserInput();
    harness.queueInput({ moveX: -1 });
    harness.runtime.onRender();

    expect(harness.sfxController.armCalls).toBe(1);
  });

  it("toggles mute on a mute edge and propagates the result to the sfx controller", () => {
    const harness = createHarness();

    harness.queueInput({ mutePressed: true });
    harness.runtime.onRender();

    expect(harness.muteStore.toggleCalls).toBe(1);
    expect(harness.muteStore.isMuted()).toBe(true);
    expect(harness.sfxController.setMutedCalls).toEqual([false, true]);
  });

  it("records the max of the stored and final score once per game-over transition", () => {
    const finalScore = 220;
    const storedHighScore = 260;
    const harness = createHarness({
      initialHighScore: storedHighScore,
      initialState: createPlayingState(),
      step: (state) =>
        state.phase === "playing"
          ? {
              ...state,
              phase: "gameOver",
              hud: {
                ...state.hud,
                score: finalScore
              }
            }
          : {
              ...state,
              frame: state.frame + 1
            }
    });

    harness.runtime.onStep({ dtMs: 16, firstStepOfFrame: true });
    harness.runtime.onStep({ dtMs: 16, firstStepOfFrame: true });

    expect(harness.writeHighScoreCalls).toEqual([storedHighScore]);
  });

  it("dispatches each derived event once across multiple fixed sub-steps in a frame", () => {
    const initialState = createPlayingState();
    const shootState = withPlayerProjectileCount(initialState, 1);
    const hitState = {
      ...shootState,
      invaders: shootState.invaders.slice(1)
    };
    const duplicateShootState = withPlayerProjectileCount(shootState, 2);
    let stepIndex = 0;
    const harness = createHarness({
      deriveEvents: deriveSfxEvents,
      initialState,
      step: (state, _dtMs, input) => {
        const currentStep = stepIndex;
        stepIndex += 1;

        if (currentStep === 0) {
          return input.firePressed ? shootState : state;
        }

        if (currentStep === 1) {
          return input.firePressed ? duplicateShootState : hitState;
        }

        return state;
      }
    });

    harness.queueInput({ firePressed: true });
    harness.runtime.onRender();
    harness.runtime.onStep({ dtMs: 16, firstStepOfFrame: true });
    harness.runtime.onStep({ dtMs: 16, firstStepOfFrame: false });

    expect(harness.stepCalls.map((call) => call.input.firePressed)).toEqual([
      true,
      false
    ]);
    expect(harness.sfxController.playCalls).toEqual(["shoot", "hit"]);
  });
});

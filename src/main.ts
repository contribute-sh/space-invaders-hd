import { deriveSfxEvents } from "./audio/events";
import { createMuteStore } from "./audio/mute";
import { createSfxController } from "./audio/sfx";
import {
  EMPTY_INPUT,
  createInitialGameState,
  type GameState,
  type Input
} from "./game/state";
import { step } from "./game/step";
import { createKeyboardController } from "./input/keyboard";
import { createFixedStepLoop } from "./loop/fixedStep";
import { createHighScoreStore, pickDisplayHighScore } from "./persistence";
import { createCanvasRenderer, type CanvasRenderer } from "./render/canvas";
import { createVisibilityPauseController } from "./visibility";

const FIXED_TIMESTEP_MS = 1000 / 60;
type RuntimeRenderFlags = Parameters<CanvasRenderer["render"]>[1];
type KeyboardController = ReturnType<typeof createKeyboardController>;

export function bootstrap(
  options: {
    beforeUnloadTarget?: Pick<Window, "addEventListener" | "removeEventListener">;
    createLoop?: typeof createFixedStepLoop;
    createVisibilityPauseController?: typeof createVisibilityPauseController;
    deriveSfxEvents?: typeof deriveSfxEvents;
    findCanvas?: () => HTMLCanvasElement | null;
    highScoreStore?: ReturnType<typeof createHighScoreStore>;
    initialState?: GameState;
    isHidden?: () => boolean;
    keyboard?: KeyboardController;
    keyboardTarget?: Window;
    muteStore?: ReturnType<typeof createMuteStore>;
    renderer?: CanvasRenderer;
    sfx?: ReturnType<typeof createSfxController>;
    step?: (state: GameState, dtMs: number, input: Input) => GameState;
    storage?: Storage;
    visibilityTarget?: Pick<Document, "addEventListener" | "removeEventListener">;
  } = {}
) {
  const resolveHidden = options.isHidden ?? (() => getDefaultDocument().hidden);
  const renderer =
    options.renderer ?? createRenderer(getRequiredCanvas(options.findCanvas));
  const keyboard =
    options.keyboard ??
    createKeyboardController(options.keyboardTarget ?? getDefaultWindow());
  const sfx = options.sfx ?? createSfxController();
  const muteStore = options.muteStore ?? createMuteStore(options.storage);
  const highScoreStore =
    options.highScoreStore ?? createHighScoreStore(options.storage);
  const createLoop = options.createLoop ?? createFixedStepLoop;
  const createVisibilityController =
    options.createVisibilityPauseController ?? createVisibilityPauseController;
  const advanceGameState = options.step ?? step;
  const deriveAudioEvents = options.deriveSfxEvents ?? deriveSfxEvents;
  const visibilityTarget = options.visibilityTarget ?? getDefaultDocument();
  const beforeUnloadTarget =
    options.beforeUnloadTarget ?? getDefaultWindow();

  let state = options.initialState ?? createInitialGameState();
  let bootstrapping = true;
  let audioAttempted = false;
  let frameInput: Input = keyboard.snapshot();

  const createRenderFlags = (): RuntimeRenderFlags => ({
    bootstrapping,
    muted: muteStore.isMuted(),
    highScore: pickDisplayHighScore(
      highScoreStore.getHighScore(),
      state.hud.score
    )
  });

  const maybeArmAudio = (phase: GameState["phase"], input: Input): void => {
    if (audioAttempted) {
      return;
    }

    const leavesOverlay =
      ((phase === "start" || phase === "waveClear" || phase === "gameOver") &&
        input.firePressed) ||
      (phase === "paused" && input.pausePressed);

    if (!leavesOverlay) {
      return;
    }

    audioAttempted = true;
    void sfx.arm();
  };

  const maybeRecordHighScore = (score: number): void => {
    if (score <= highScoreStore.getHighScore()) {
      return;
    }

    highScoreStore.recordScore(score);
  };

  const playDerivedEvents = (
    previousState: GameState,
    nextState: GameState
  ): void => {
    for (const event of deriveAudioEvents(previousState, nextState)) {
      sfx.play(event);
    }
  };

  const advanceState = (dtMs: number, input: Input): void => {
    const previousState = state;
    state = advanceGameState(state, dtMs, input);
    maybeRecordHighScore(state.hud.score);
    playDerivedEvents(previousState, state);
  };

  sfx.setMuted(muteStore.isMuted());
  renderer.render(state, createRenderFlags());
  bootstrapping = false;
  maybeArmAudio(state.phase, frameInput);

  const visibilityPauseController = createVisibilityController({
    target: visibilityTarget,
    isHidden: resolveHidden,
    onHide: () => {
      if (state.phase !== "playing") {
        return;
      }

      advanceState(0, {
        ...EMPTY_INPUT,
        pausePressed: true
      });
    }
  });

  const loop = createLoop({
    stepMs: FIXED_TIMESTEP_MS,
    onStep: ({ dtMs, firstStepOfFrame }) => {
      const stepInput = firstStepOfFrame
        ? frameInput
        : {
            ...frameInput,
            firePressed: false,
            pausePressed: false,
            mutePressed: false
          };
      advanceState(dtMs, stepInput);
    },
    onRender: () => {
      frameInput = keyboard.snapshot();

      if (frameInput.mutePressed) {
        muteStore.toggle();
        sfx.setMuted(muteStore.isMuted());
      }

      maybeArmAudio(state.phase, frameInput);
      renderer.render(state, createRenderFlags());
    },
    isHidden: resolveHidden
  });

  let disposed = false;
  let dispose = (): void => {};

  const onBeforeUnload = (): void => {
    dispose();
  };

  dispose = (): void => {
    if (disposed) {
      return;
    }

    disposed = true;
    beforeUnloadTarget.removeEventListener("beforeunload", onBeforeUnload);
    loop.stop();
    keyboard.dispose();
    visibilityPauseController.dispose();
  };

  beforeUnloadTarget.addEventListener("beforeunload", onBeforeUnload);
  loop.start();

  return {
    dispose,
    loop
  };
}

function renderFallback(title: string, detail: string): void {
  const shell = document.querySelector(".frame");
  if (shell === null) {
    return;
  }

  shell.innerHTML = `
    <section class="fallback" role="alert">
      <h1>${title}</h1>
      <p>${detail}</p>
    </section>
  `;
}

function createRenderer(canvasElement: HTMLCanvasElement): CanvasRenderer {
  try {
    return createCanvasRenderer(canvasElement);
  } catch (error) {
    renderFallback(
      "Canvas 2D is unavailable in this browser.",
      "This MVP needs a browser with Canvas 2D support."
    );
    throw error;
  }
}

function getDefaultDocument(): Document {
  if (typeof document === "undefined") {
    throw new Error("Document is required to bootstrap the game.");
  }

  return document;
}

function getDefaultWindow(): Window {
  if (typeof window === "undefined") {
    throw new Error("Window is required to bootstrap the game.");
  }

  return window;
}

function getRequiredCanvas(
  findCanvas: (() => HTMLCanvasElement | null) | undefined
): HTMLCanvasElement {
  const canvas =
    findCanvas === undefined
      ? getDefaultDocument().querySelector<HTMLCanvasElement>("#game")
      : findCanvas();

  if (canvas === null) {
    throw new Error("Game canvas not found.");
  }

  return canvas;
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  bootstrap();
}

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
import { createHighScoreStore } from "./persistence";
import { createCanvasRenderer, type CanvasRenderer } from "./render/canvas";
import { createGameRuntime } from "./runtime";
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
  let bootstrapping = true;
  const userInputTarget = options.keyboardTarget ?? maybeGetWindow();
  const frameInput = cloneInput(EMPTY_INPUT);

  const createRenderFlags = (): RuntimeRenderFlags => ({
    bootstrapping,
    muted: runtime.isMuted(),
    highScore: runtime.getDisplayHighScore()
  });

  const readInput = (): Input => {
    assignInput(frameInput, keyboard.snapshot());
    return frameInput;
  };

  const runtime = createGameRuntime({
    deriveSfxEvents: deriveAudioEvents,
    initialState: options.initialState ?? createInitialGameState(),
    muteStore,
    readHighScore: () => highScoreStore.getHighScore(),
    readInput,
    sfxController: sfx,
    step: (state, dtMs, input) => advanceGameState(state, dtMs, cloneInput(input)),
    writeHighScore: (score) => {
      highScoreStore.recordScore(score);
    }
  });

  const renderRuntime = (): void => {
    renderer.render(runtime.getState(), createRenderFlags());
  };

  renderRuntime();
  bootstrapping = false;

  const visibilityPauseController = createVisibilityController({
    target: visibilityTarget,
    isHidden: resolveHidden,
    onHide: () => {
      if (runtime.getState().phase !== "playing") {
        return;
      }

      assignInput(frameInput, createPauseInput());
      runtime.onStep({ dtMs: 0, firstStepOfFrame: true });
      assignInput(frameInput, EMPTY_INPUT);
    }
  });

  const loop = createLoop({
    stepMs: FIXED_TIMESTEP_MS,
    onStep: ({ dtMs, firstStepOfFrame }) => {
      runtime.onStep({ dtMs, firstStepOfFrame });
    },
    onRender: () => {
      runtime.onRender();
      renderRuntime();
    },
    isHidden: resolveHidden
  });

  let disposed = false;
  let dispose = (): void => {};
  const onUserInput = (): void => {
    runtime.onUserInput();
  };

  const onBeforeUnload = (): void => {
    dispose();
  };

  dispose = (): void => {
    if (disposed) {
      return;
    }

    disposed = true;
    beforeUnloadTarget.removeEventListener("beforeunload", onBeforeUnload);
    userInputTarget?.removeEventListener("keydown", onUserInput);
    userInputTarget?.removeEventListener("pointerdown", onUserInput);
    loop.stop();
    keyboard.dispose();
    visibilityPauseController.dispose();
  };

  beforeUnloadTarget.addEventListener("beforeunload", onBeforeUnload);
  userInputTarget?.addEventListener("keydown", onUserInput);
  userInputTarget?.addEventListener("pointerdown", onUserInput);
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

function maybeGetWindow(): Window | undefined {
  return typeof window === "undefined" ? undefined : window;
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

function cloneInput(input: Input): Input {
  return {
    ...EMPTY_INPUT,
    ...input
  };
}

function assignInput(target: Input, input: Input): void {
  target.moveX = input.moveX;
  target.firePressed = input.firePressed;
  target.pausePressed = input.pausePressed;
  target.fireHeld = input.fireHeld;
  target.pauseHeld = input.pauseHeld;
  target.mutePressed = input.mutePressed;
}

function createPauseInput(): Input {
  return {
    ...EMPTY_INPUT,
    pausePressed: true
  };
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  bootstrap();
}

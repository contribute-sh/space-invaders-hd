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
    beforeUnloadTarget?: Pick<Window, "addEventListener">;
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
  let frameInput: Input = { ...EMPTY_INPUT };

  const runtime = createGameRuntime({
    deriveSfxEvents: deriveAudioEvents,
    initialState: options.initialState ?? createInitialGameState(),
    muteStore,
    readHighScore: () => highScoreStore.getHighScore(),
    readInput: () => {
      const input = keyboard.snapshot();

      frameInput = input;
      return input;
    },
    sfxController: sfx,
    step: advanceGameState,
    writeHighScore: (score) => {
      highScoreStore.recordScore(score);
    }
  });

  const createRenderFlags = (): RuntimeRenderFlags => ({
    bootstrapping,
    muted: runtime.isMuted(),
    highScore: runtime.getDisplayHighScore()
  });

  const render = (): void => {
    renderer.render(runtime.getState(), createRenderFlags());
  };

  render();
  bootstrapping = false;

  const visibilityPauseController = createVisibilityController({
    target: visibilityTarget,
    isHidden: resolveHidden,
    onHide: () => {
      if (runtime.getState().phase !== "playing") {
        return;
      }

      frameInput.moveX = 0;
      frameInput.firePressed = false;
      frameInput.pausePressed = true;
      frameInput.fireHeld = false;
      frameInput.pauseHeld = false;
      frameInput.mutePressed = false;
      runtime.onStep({
        dtMs: 0,
        firstStepOfFrame: true
      });
    }
  });

  const loop = createLoop({
    stepMs: FIXED_TIMESTEP_MS,
    onStep: ({ dtMs, firstStepOfFrame }) =>
      runtime.onStep({ dtMs, firstStepOfFrame }),
    onRender: () => {
      runtime.onRender();
      render();
    },
    isHidden: resolveHidden
  });

  const dispose = (): void => {
    loop.stop();
    keyboard.dispose();
    visibilityPauseController.dispose();
  };

  beforeUnloadTarget.addEventListener("beforeunload", dispose);
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

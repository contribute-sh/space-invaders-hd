import { deriveSfxEvents } from "./audio/events";
import { createMuteStore } from "./audio/mute";
import { createSfxController } from "./audio/sfx";
import { createInitialGameState } from "./game/state";
import { createKeyboardController } from "./input/keyboard";
import { createFixedStepLoop } from "./loop/fixedStep";
import { createHighScoreStore } from "./persistence";
import { createCanvasRenderer, type RenderFlags } from "./render/canvas";
import { createGameRuntime } from "./runtime";
import { step } from "./game/step";
import { createVisibilityPauseController } from "./visibility";

const FIXED_TIMESTEP_MS = 1000 / 60;

const canvas = document.querySelector<HTMLCanvasElement>("#game");

if (canvas === null) {
  throw new Error("Game canvas not found.");
}

const renderer = createRenderer(canvas);
const keyboard = createKeyboardController(window);
const sfx = createSfxController();
const muteStore = createMuteStore();
const highScoreStore = createHighScoreStore();
let bootstrapping = true;
let visibilityPauseRequested = false;

const runtime = createGameRuntime({
  deriveSfxEvents,
  initialState: createInitialGameState(),
  muteStore,
  readHighScore: () => highScoreStore.getHighScore(),
  readInput: () => {
    const snapshot = keyboard.snapshot();

    if (!visibilityPauseRequested) {
      return snapshot;
    }

    return {
      ...snapshot,
      pausePressed: true
    };
  },
  sfxController: sfx,
  step,
  writeHighScore: (score) => {
    highScoreStore.recordScore(score);
  }
});

render();
bootstrapping = false;

const handleUserInput = (): void => {
  runtime.onUserInput();
};

window.addEventListener("keydown", handleUserInput);
window.addEventListener("pointerdown", handleUserInput);

const visibilityPauseController = createVisibilityPauseController({
  target: document,
  isHidden: () => document.hidden,
  onHide: () => {
    if (runtime.getState().phase !== "playing") {
      return;
    }

    visibilityPauseRequested = true;
  }
});

const loop = createFixedStepLoop({
  stepMs: FIXED_TIMESTEP_MS,
  onStep: runtime.onStep,
  onRender: () => {
    runtime.onRender();

    if (visibilityPauseRequested) {
      runtime.onStep({ dtMs: 0, firstStepOfFrame: true });
      visibilityPauseRequested = false;
    }

    render();
  }
});

window.addEventListener("beforeunload", () => {
  loop.stop();
  keyboard.dispose();
  visibilityPauseController.dispose();
  window.removeEventListener("keydown", handleUserInput);
  window.removeEventListener("pointerdown", handleUserInput);
});

loop.start();

function render(): void {
  renderer.render(runtime.getState(), createRenderFlags());
}

function createRenderFlags(): RenderFlags {
  return {
    bootstrapping,
    muted: runtime.isMuted(),
    highScore: runtime.getDisplayHighScore()
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

function createRenderer(canvasElement: HTMLCanvasElement) {
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

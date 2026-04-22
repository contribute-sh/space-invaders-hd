import { createSfxController, type SfxName } from "./audio/sfx";
import { createInitialGameState, type GameState, type Input } from "./game/state";
import { step } from "./game/step";
import { createKeyboardController } from "./input/keyboard";
import { createFixedStepLoop } from "./loop/fixedStep";
import { createHighScoreStore } from "./persistence";
import { createCanvasRenderer, type CanvasRenderer } from "./render/canvas";

const FIXED_TIMESTEP_MS = 1000 / 60;
type RuntimeRenderFlags = Parameters<CanvasRenderer["render"]>[1];

const canvas = document.querySelector<HTMLCanvasElement>("#game");

if (canvas === null) {
  throw new Error("Game canvas not found.");
}

const renderer = createRenderer(canvas);
const keyboard = createKeyboardController(window);
const sfx = createSfxController();
const highScoreStore = createHighScoreStore();

let state = createInitialGameState();
let bootstrapping = true;
let audioAttempted = false;
let frameInput: Input = keyboard.snapshot();

renderer.render(state, createRenderFlags(false));
bootstrapping = false;
maybeArmAudio(state.phase, frameInput);

const loop = createFixedStepLoop({
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
    const previousState = state;
    state = step(state, dtMs, stepInput);
    maybeRecordHighScore(previousState, state);
    playDerivedEvents(previousState, state);
  },
  onRender: () => {
    frameInput = keyboard.snapshot();
    maybeArmAudio(state.phase, frameInput);
    renderer.render(state, createRenderFlags(sfx.getStatus() === "muted"));
  }
});

window.addEventListener("beforeunload", () => {
  loop.stop();
  keyboard.dispose();
});

loop.start();

function maybeArmAudio(phase: GameState["phase"], input: Input): void {
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
}

function playDerivedEvents(previousState: GameState, nextState: GameState): void {
  const events: SfxName[] = [];

  if (nextState.projectiles.length > previousState.projectiles.length) {
    events.push("shoot");
  }

  if (nextState.invaders.length < previousState.invaders.length) {
    events.push("hit");
  }

  if (
    previousState.phase !== "lifeLost" &&
    nextState.phase === "lifeLost"
  ) {
    events.push("playerDeath");
  }

  if (
    previousState.phase !== "waveClear" &&
    nextState.phase === "waveClear"
  ) {
    events.push("waveClear");
  }

  for (const event of events) {
    sfx.play(event);
  }
}

function maybeRecordHighScore(
  previousState: GameState,
  nextState: GameState
): void {
  if (previousState.phase === "gameOver" || nextState.phase !== "gameOver") {
    return;
  }

  highScoreStore.recordScore(nextState.hud.score);
}

function createRenderFlags(muted: boolean): RuntimeRenderFlags {
  return {
    bootstrapping,
    muted,
    highScore: highScoreStore.getHighScore()
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

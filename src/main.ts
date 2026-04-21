import { createSfxController, type SfxName } from "./audio/sfx";
import { createInitialGameState, type GameState, type Input } from "./game/state";
import { step } from "./game/step";
import { createKeyboardController } from "./input/keyboard";
import { createHighScoreStore } from "./persistence";
import { createCanvasRenderer, type CanvasRenderer } from "./render/canvas";

const FIXED_TIMESTEP_MS = 1000 / 60;
type RuntimeRenderFlags = Parameters<CanvasRenderer["render"]>[1] & {
  highScore: number;
};

const canvas = document.querySelector<HTMLCanvasElement>("#game");

if (canvas === null) {
  throw new Error("Game canvas not found.");
}

const renderer = createRenderer(canvas);
const keyboard = createKeyboardController(window);
const sfx = createSfxController();
const highScoreStore = createHighScoreStore();

let state = createInitialGameState();
let previousTimestamp = performance.now();
let accumulator = 0;
let bootstrapping = true;
let audioAttempted = false;
let highScore = highScoreStore.getHighScore();

renderer.render(state, createRenderFlags(false));
bootstrapping = false;

window.addEventListener("beforeunload", () => {
  keyboard.dispose();
});

requestAnimationFrame(loop);

function loop(timestamp: number): void {
  const delta = Math.min(100, timestamp - previousTimestamp);
  previousTimestamp = timestamp;
  accumulator += delta;

  const frameInput = keyboard.snapshot();
  maybeArmAudio(state.phase, frameInput);

  let firstStep = true;
  while (accumulator >= FIXED_TIMESTEP_MS) {
    const stepInput = firstStep
      ? frameInput
      : {
          ...frameInput,
          firePressed: false,
          pausePressed: false
        };
    const previousState = state;
    state = step(state, FIXED_TIMESTEP_MS, stepInput);
    highScore = maybeRecordHighScore(previousState, state);
    playDerivedEvents(previousState, state);
    accumulator -= FIXED_TIMESTEP_MS;
    firstStep = false;
  }

  renderer.render(state, createRenderFlags(sfx.getStatus() === "muted"));

  requestAnimationFrame(loop);
}

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
): number {
  if (previousState.phase === "gameOver" || nextState.phase !== "gameOver") {
    return highScore;
  }

  return highScoreStore.recordScore(nextState.hud.score);
}

function createRenderFlags(muted: boolean): RuntimeRenderFlags {
  return {
    bootstrapping,
    muted,
    highScore
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

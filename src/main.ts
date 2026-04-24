import { mapGameEventsToSfx } from "./audio/events";
import { createMuteStore } from "./audio/mute";
import { createSfxController } from "./audio/sfx";
import { deriveGameEvents, type GameEvent } from "./game/events";
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

const canvas = document.querySelector<HTMLCanvasElement>("#game");

if (canvas === null) {
  throw new Error("Game canvas not found.");
}

const renderer = createRenderer(canvas);
const keyboard = createKeyboardController(window);
const sfx = createSfxController();
const muteStore = createMuteStore();
const highScoreStore = createHighScoreStore();

let state = createInitialGameState();
let bootstrapping = true;
let audioAttempted = false;
let frameInput: Input = keyboard.snapshot();

sfx.setMuted(muteStore.isMuted());
renderer.render(state, createRenderFlags(muteStore.isMuted()));
bootstrapping = false;
maybeArmAudio(state.phase, frameInput);

const visibilityPauseController = createVisibilityPauseController({
  target: document,
  isHidden: () => document.hidden,
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
    advanceState(dtMs, stepInput);
  },
  onRender: () => {
    frameInput = keyboard.snapshot();

    if (frameInput.mutePressed) {
      muteStore.toggle();
      sfx.setMuted(muteStore.isMuted());
    }

    maybeArmAudio(state.phase, frameInput);
    renderer.render(state, createRenderFlags(muteStore.isMuted()));
  }
});

window.addEventListener("beforeunload", () => {
  loop.stop();
  keyboard.dispose();
  visibilityPauseController.dispose();
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

function advanceState(dtMs: number, input: Input): void {
  const previousState = state;
  state = step(state, dtMs, input);
  const gameEvents = deriveGameEvents(previousState, state);

  maybeRecordHighScore(gameEvents);
  playDerivedEvents(gameEvents);
}

function playDerivedEvents(gameEvents: readonly GameEvent[]): void {
  for (const event of mapGameEventsToSfx(gameEvents)) {
    sfx.play(event);
  }
}

function maybeRecordHighScore(gameEvents: readonly GameEvent[]): void {
  const scoreChangedEvent = gameEvents.find(
    (event): event is Extract<GameEvent, { type: "scoreChanged" }> =>
      event.type === "scoreChanged"
  );

  if (
    scoreChangedEvent === undefined ||
    scoreChangedEvent.nextScore <= highScoreStore.getHighScore()
  ) {
    return;
  }

  highScoreStore.recordScore(scoreChangedEvent.nextScore);
}

function createRenderFlags(muted: boolean): RuntimeRenderFlags {
  return {
    bootstrapping,
    muted,
    highScore: pickDisplayHighScore(
      highScoreStore.getHighScore(),
      state.hud.score
    )
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

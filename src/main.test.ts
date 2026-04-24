import { describe, expect, it } from "vitest";
import { createMuteStore } from "./audio/mute";
import type { AudioStatus, SfxName } from "./audio/sfx";
import { EMPTY_INPUT, createPlayingState, type GameState, type Input } from "./game/state";
import { bootstrap } from "./main";
import { createHighScoreStore } from "./persistence";
import type { CanvasRenderer } from "./render/canvas";
const HIGH_SCORE_STORAGE_KEY = "space-invaders-hd.highScore";
const MUTE_STORAGE_KEY = "audio:muted";
type HarnessOptions = {
  deriveSfxEvents?: (previousState: GameState, nextState: GameState) => SfxName[];
  initialHighScore?: number;
  initialMuted?: boolean;
  initialState?: GameState;
  sfxStatus?: AudioStatus;
  step?: (state: GameState, dtMs: number, input: Input) => GameState;
};
type ListenerRecord = {
  listener: EventListenerOrEventListenerObject | null;
  type: string;
};

class FakeStorage implements Storage {
  private readonly entries = new Map<string, string>();
  constructor(seed: Record<string, string>) { for (const [key, value] of Object.entries(seed)) this.entries.set(key, value); }
  get length(): number { return this.entries.size; }
  clear(): void { this.entries.clear(); }
  getItem(key: string): string | null { return this.entries.get(key) ?? null; }
  key(index: number): string | null { return [...this.entries.keys()][index] ?? null; }
  removeItem(key: string): void { this.entries.delete(key); }
  setItem(key: string, value: string): void { this.entries.set(key, value); }
}

class FakeBeforeUnloadTarget {
  readonly addedListeners: ListenerRecord[] = [];
  readonly removedListeners: ListenerRecord[] = [];

  addEventListener(type: string, listener: EventListenerOrEventListenerObject | null): void {
    this.addedListeners.push({ type, listener });
  }

  removeEventListener(type: string, listener: EventListenerOrEventListenerObject | null): void {
    this.removedListeners.push({ type, listener });
  }
}

class FakeElement {
  readonly children: FakeElement[] = [];
  readonly tagName: string;
  className = "";
  textContent: string | null = null;
  private readonly attributes = new Map<string, string>();

  constructor(tagName: string) {
    this.tagName = tagName.toUpperCase();
  }

  append(...nodes: FakeElement[]): void {
    this.children.push(...nodes);
  }

  replaceChildren(...nodes: FakeElement[]): void {
    this.children.length = 0;
    this.children.push(...nodes);
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  querySelector(selector: string): FakeElement | null {
    for (const child of this.children) {
      if (child.matches(selector)) {
        return child;
      }

      const match = child.querySelector(selector);
      if (match !== null) {
        return match;
      }
    }

    return null;
  }

  private matches(selector: string): boolean {
    if (selector.startsWith(".")) {
      return this.className
        .split(/\s+/u)
        .filter((token) => token.length > 0)
        .includes(selector.slice(1));
    }

    return this.tagName === selector.toUpperCase();
  }
}

class FakeCanvasElement extends FakeElement {
  constructor() {
    super("canvas");
  }

  getContext(): null {
    return null;
  }
}

class FakeDocument {
  readonly body = new FakeElement("body");
  hidden = false;

  addEventListener(): void {}

  removeEventListener(): void {}

  createElement(tagName: "canvas"): FakeCanvasElement;
  createElement(tagName: string): FakeElement;
  createElement(tagName: string): FakeElement {
    return tagName === "canvas" ? new FakeCanvasElement() : new FakeElement(tagName);
  }

  querySelector(selector: string): FakeElement | null {
    return this.body.querySelector(selector);
  }
}

function createInput(input: Partial<Input> = {}): Input { return { ...EMPTY_INPUT, ...input }; }
function createHarness(options: HarnessOptions = {}) {
  const storage = new FakeStorage({
    ...(options.initialMuted === undefined ? {} : { [MUTE_STORAGE_KEY]: String(options.initialMuted) }),
    ...(options.initialHighScore === undefined
      ? {}
      : { [HIGH_SCORE_STORAGE_KEY]: String(options.initialHighScore) })
  });
  const keyboard = { queued: createInput(), queue(input: Partial<Input> = {}): void { this.queued = createInput(input); }, dispose(): void {}, snapshot(): Input { const input = this.queued; this.queued = createInput(); return input; } };
  let audioArmed = false;
  let audioMuted = false;
  const sfx = {
    armCalls: 0,
    playCalls: [] as SfxName[],
    setMutedCalls: [] as boolean[],
    arm: async (): Promise<void> => { sfx.armCalls += 1; audioArmed = true; },
    getStatus: (): AudioStatus => {
      if (options.sfxStatus !== undefined) {
        return options.sfxStatus;
      }

      if (audioMuted) {
        return "muted";
      }

      return audioArmed ? "ready" : "idle";
    },
    play: (name: SfxName): void => void sfx.playCalls.push(name),
    setMuted: (muted: boolean): void => {
      sfx.setMutedCalls.push(muted);
      audioMuted = muted;
    }
  };
  const stepCalls: Array<{ dtMs: number; input: Input; state: GameState }> = [];
  let hidden = false;
  let latestRender: { state: GameState; flags: Parameters<CanvasRenderer["render"]>[1] } | undefined;
  let loop: {
    isHidden?: () => boolean;
    onRender: () => void;
    onStep: (input: { dtMs: number; firstStepOfFrame: boolean }) => void;
    stepMs: number;
  } | undefined;
  let onHide: (() => void) | undefined;
  const step =
    options.step ??
    ((state: GameState, dtMs: number, input: Input) => { void dtMs; void input; return state; });
  bootstrap({
    beforeUnloadTarget: { addEventListener: () => {}, removeEventListener: () => {} },
    createLoop: (config) => { loop = config; return { start: () => {}, stop: () => {} }; },
    createVisibilityPauseController: ({ onHide: hide }) => { onHide = hide; return { dispose: () => {} }; },
    deriveSfxEvents: options.deriveSfxEvents ?? (() => []),
    highScoreStore: createHighScoreStore(storage),
    initialState: options.initialState,
    isHidden: () => hidden,
    keyboard,
    muteStore: createMuteStore(storage),
    renderer: { render: (state, flags) => void (latestRender = { state, flags: { ...flags } }) },
    sfx,
    step: (state, dtMs, input) => {
      stepCalls.push({ dtMs, input, state });
      return step(state, dtMs, input);
    },
    visibilityTarget: { addEventListener: () => {}, removeEventListener: () => {} }
  });
  const readLoop = () => { if (loop === undefined) throw new Error("Expected loop."); return loop; };
  const readRender = () => { if (latestRender === undefined) throw new Error("Expected render."); return latestRender; };
  return {
    keyboard,
    sfx,
    stepCalls,
    storage,
    latestRender: readRender,
    setHidden: (nextHidden: boolean): void => { hidden = nextHidden; },
    triggerHide: (): void => { if (onHide === undefined) throw new Error("Expected hide handler."); onHide(); },
    render: (): void => {
      const config = readLoop();
      if (config.isHidden?.() !== true) config.onRender();
    },
    frame: (steps = 1): void => {
      const config = readLoop();
      if (config.isHidden?.() === true) return;
      for (let index = 0; index < steps; index += 1) {
        config.onStep({ dtMs: config.stepMs, firstStepOfFrame: index === 0 });
      }
      config.onRender();
    }
  };
}

describe("bootstrap", () => {
  it("arms audio once and persists mute changes", () => {
    const harness = createHarness({ initialMuted: true });
    expect(harness.sfx.setMutedCalls).toEqual([true]);
    expect(harness.latestRender().flags).toEqual({
      bootstrapping: true,
      highScore: 0,
      audioStatus: "muted"
    });
    harness.keyboard.queue({ firePressed: true });
    harness.render();
    harness.keyboard.queue({ firePressed: true });
    harness.render();
    harness.keyboard.queue({ mutePressed: true });
    harness.render();
    expect(harness.sfx.armCalls).toBe(1);
    expect(harness.sfx.setMutedCalls).toEqual([true, false]);
    expect(harness.storage.getItem(MUTE_STORAGE_KEY)).toBe("false");
    expect(harness.latestRender().flags.audioStatus).toBe("ready");
  });

  it("passes the controller audio status through to render flags", () => {
    const harness = createHarness({ sfxStatus: "unavailable" });

    expect(harness.latestRender().flags.audioStatus).toBe("unavailable");
  });
  it("records a new high score when gameplay reaches game over", () => {
    const harness = createHarness({
      initialHighScore: 200,
      initialState: createPlayingState({ score: 180 }),
      step: (state) => ({ ...state, phase: "gameOver", hud: { ...state.hud, score: 320 } })
    });
    harness.frame();
    expect(harness.storage.getItem(HIGH_SCORE_STORAGE_KEY)).toBe("320");
    expect(harness.latestRender().state.phase).toBe("gameOver");
    expect(harness.latestRender().flags.highScore).toBe(320);
  });
  it("auto-pauses on hide and skips simulation work while hidden", () => {
    const playing = createPlayingState();
    const harness = createHarness({
      initialState: playing,
      step: (state, _dtMs, input) => (input.pausePressed ? { ...state, phase: "paused" } : state)
    });
    harness.setHidden(true);
    harness.triggerHide();
    harness.frame();
    harness.setHidden(false);
    harness.render();
    expect(harness.stepCalls).toEqual([{ dtMs: 0, input: createInput({ pausePressed: true }), state: playing }]);
    expect(harness.latestRender().state.phase).toBe("paused");
  });
  it("surfaces step transitions to the renderer and sfx sinks", () => {
    const playing = createPlayingState();
    const lifeLost = { ...playing, phase: "lifeLost" as const, hud: { ...playing.hud, score: 120, lives: 2 } };
    const waveClear = { ...playing, phase: "waveClear" as const, invaders: [], hud: { ...playing.hud, score: 260, lives: 2 } };
    let index = 0;
    const harness = createHarness({
      deriveSfxEvents: (_previousState, nextState) =>
        nextState.phase === "lifeLost"
          ? ["playerDeath"]
          : nextState.phase === "waveClear"
            ? ["waveClear"]
            : [],
      initialState: playing,
      step: () => (index++ === 0 ? lifeLost : waveClear)
    });
    harness.frame();
    expect(harness.sfx.playCalls).toEqual(["playerDeath"]);
    expect(harness.latestRender().state.hud).toEqual(lifeLost.hud);
    harness.frame();
    expect(harness.sfx.playCalls).toEqual(["playerDeath", "waveClear"]);
    expect(harness.latestRender().state.phase).toBe("waveClear");
    expect(harness.latestRender().flags.highScore).toBe(260);
  });
  it("throws when the game canvas is missing", () => {
    expect(() => bootstrap({ findCanvas: () => null })).toThrowError("Game canvas not found.");
  });

  it("renders the canvas fallback into the injected document as plain text", () => {
    const fallbackDocument = new FakeDocument();
    const frame = fallbackDocument.createElement("section");
    frame.className = "frame";
    frame.setAttribute("aria-label", "Game shell");
    fallbackDocument.body.append(frame);

    const canvas = fallbackDocument.createElement("canvas");
    const title = 'Canvas <script type="text/javascript">window.hacked = true</script>';
    const detail = "Use <strong>Canvas 2D</strong> support instead.";

    expect(() =>
      bootstrap({
        canvasUnavailableFallback: { title, detail },
        document: fallbackDocument as unknown as Document,
        findCanvas: () => canvas as unknown as HTMLCanvasElement
      })
    ).toThrowError("Canvas 2D is unavailable.");

    const fallback = frame.querySelector(".fallback");
    const children = fallback === null ? [] : Array.from(fallback.children);

    expect(fallback).not.toBeNull();
    expect(fallback?.getAttribute("role")).toBe("alert");
    expect(children).toHaveLength(2);
    expect(children[0]?.tagName).toBe("H1");
    expect(children[0]?.textContent).toBe(title);
    expect(children[1]?.tagName).toBe("P");
    expect(children[1]?.textContent).toBe(detail);
    expect(fallbackDocument.querySelector("script")).toBeNull();
    expect(fallbackDocument.querySelector("strong")).toBeNull();
  });

  it("removes the beforeunload listener when disposed", () => {
    const beforeUnloadTarget = new FakeBeforeUnloadTarget();
    const { dispose } = bootstrap({
      beforeUnloadTarget: beforeUnloadTarget as Pick<
        Window,
        "addEventListener" | "removeEventListener"
      >,
      createLoop: () => ({ start: () => {}, stop: () => {} }),
      createVisibilityPauseController: () => ({ dispose: () => {} }),
      findCanvas: () => document.createElement("canvas"),
      isHidden: () => false,
      keyboard: { dispose: () => {}, snapshot: () => EMPTY_INPUT },
      renderer: { render: () => {} },
      sfx: {
        arm: async () => {},
        getStatus: () => "idle",
        play: () => {},
        setMuted: () => {}
      },
      visibilityTarget: { addEventListener: () => {}, removeEventListener: () => {} }
    });

    dispose();
    dispose();

    expect(beforeUnloadTarget.addedListeners).toHaveLength(1);
    expect(beforeUnloadTarget.removedListeners).toHaveLength(1);
    expect(beforeUnloadTarget.addedListeners[0]?.type).toBe("beforeunload");
    expect(beforeUnloadTarget.removedListeners[0]?.type).toBe("beforeunload");
    expect(beforeUnloadTarget.removedListeners[0]?.listener).toBe(
      beforeUnloadTarget.addedListeners[0]?.listener
    );
  });
});

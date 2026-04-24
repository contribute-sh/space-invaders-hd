import { afterEach, describe, expect, it, vi } from "vitest";

import { createGameState, createPlayingState } from "../game/state";
import { CONTROL_FOOTER, OVERLAY_PROMPTS } from "../input/bindings";
import { createCanvasRenderer } from "./canvas";
import { PLAYER_SHIP_DESCRIPTOR } from "./sprites";

const HUD_TOP = 18;
const HUD_HEIGHT = 68;
const HUD_SHIP_COLORS = new Set(Object.values(PLAYER_SHIP_DESCRIPTOR.palette));
const PLAYER_INVULNERABILITY_HALO_COLOR = "rgba(123, 229, 255, 0.22)";
const PLAYER_INVULNERABILITY_HALO_MARGIN = 12;
const PLAYER_SHIP_PIXEL_COUNT = PLAYER_SHIP_DESCRIPTOR.frames.reduce(
  (frameCount, frame) =>
    frameCount +
    frame.reduce(
      (rowCount, row) => rowCount + [...row].filter((pixel) => pixel !== ".").length,
      0
    ),
  0
);

type FillRectCall = {
  fillStyle: string | CanvasGradient | CanvasPattern;
  x: number;
  y: number;
  width: number;
  height: number;
};

type FillTextCall = {
  font: string;
  text: string;
  textAlign: CanvasTextAlign;
  x: number;
  y: number;
};

type SetTransformCall = [number, number, number, number, number, number];

class FakeCanvasGradient {
  readonly colorStops: Array<{ color: string; offset: number }> = [];

  addColorStop(offset: number, color: string): void {
    this.colorStops.push({ color, offset });
  }
}

class FakeCanvasContext {
  readonly fillRectCalls: FillRectCall[] = [];
  readonly fillTextCalls: FillTextCall[] = [];
  readonly setTransformCalls: SetTransformCall[] = [];

  fillStyle: string | CanvasGradient | CanvasPattern = "";
  font = "";
  lineWidth = 1;
  strokeStyle: string | CanvasGradient | CanvasPattern = "";
  textAlign: CanvasTextAlign = "start";

  arc(): void {}

  beginPath(): void {}

  clearRect(): void {}

  closePath(): void {}

  createLinearGradient(): CanvasGradient {
    return new FakeCanvasGradient() as unknown as CanvasGradient;
  }

  createRadialGradient(): CanvasGradient {
    return new FakeCanvasGradient() as unknown as CanvasGradient;
  }

  fill(): void {}

  fillRect(x: number, y: number, width: number, height: number): void {
    this.fillRectCalls.push({
      fillStyle: this.fillStyle,
      x,
      y,
      width,
      height
    });
  }

  fillText(text: string, x: number, y: number): void {
    this.fillTextCalls.push({
      font: this.font,
      text,
      textAlign: this.textAlign,
      x,
      y
    });
  }

  lineTo(): void {}

  moveTo(): void {}

  roundRect(): void {}

  setTransform(
    a: number,
    b: number,
    c: number,
    d: number,
    e: number,
    f: number
  ): void {
    this.setTransformCalls.push([a, b, c, d, e, f]);
  }

  stroke(): void {}
}

function createFakeCanvas(
  context: FakeCanvasContext,
  overrides: Partial<{
    clientHeight: number;
    clientWidth: number;
    height: number;
    style: {
      height: string;
      width: string;
    };
    width: number;
  }> = {}
): HTMLCanvasElement {
  return {
    clientHeight: 0,
    clientWidth: 0,
    getContext: (contextId: string) =>
      contextId === "2d" ? (context as unknown as CanvasRenderingContext2D) : null,
    height: 0,
    style: {
      height: "",
      width: ""
    },
    width: 0,
    ...overrides
  } as HTMLCanvasElement;
}

function countClusters(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  let clusterCount = 1;
  let previous = values[0];

  for (const value of values.slice(1)) {
    if (previous !== undefined && value - previous > 8) {
      clusterCount += 1;
    }

    previous = value;
  }

  return clusterCount;
}

function getPlayerShipFillRects(
  context: FakeCanvasContext,
  state: ReturnType<typeof createPlayingState>
): FillRectCall[] {
  return context.fillRectCalls.filter(
    (call) =>
      typeof call.fillStyle === "string" &&
      HUD_SHIP_COLORS.has(call.fillStyle) &&
      call.x >= state.player.x &&
      call.x < state.player.x + state.player.width &&
      call.y >= state.player.y &&
      call.y < state.player.y + state.player.height
  );
}

function findPlayerInvulnerabilityHalo(
  context: FakeCanvasContext,
  state: ReturnType<typeof createPlayingState>
): FillRectCall | undefined {
  return context.fillRectCalls.find(
    (call) =>
      call.fillStyle === PLAYER_INVULNERABILITY_HALO_COLOR &&
      call.x === state.player.x - PLAYER_INVULNERABILITY_HALO_MARGIN &&
      call.y === state.player.y - PLAYER_INVULNERABILITY_HALO_MARGIN &&
      call.width === state.player.width + PLAYER_INVULNERABILITY_HALO_MARGIN * 2 &&
      call.height === state.player.height + PLAYER_INVULNERABILITY_HALO_MARGIN * 2
  );
}

describe("createCanvasRenderer", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sizes the backing store for a wide DPR viewport and applies a letterboxed transform", () => {
    vi.stubGlobal("window", { devicePixelRatio: 2 });

    const context = new FakeCanvasContext();
    const canvas = createFakeCanvas(context, {
      clientWidth: 1280,
      clientHeight: 720
    });
    const renderer = createCanvasRenderer(canvas);
    const state = {
      ...createPlayingState(),
      invaders: [],
      projectiles: []
    };

    renderer.render(state, {
      bootstrapping: false,
      highScore: 0,
      audioStatus: "ready"
    });

    expect(canvas.width).toBe(2560);
    expect(canvas.height).toBe(1440);
    expect(canvas.style.width).toBe("1280px");
    expect(canvas.style.height).toBe("720px");
    expect(context.setTransformCalls.at(-1)).toEqual([2, 0, 0, 2, 320, 0]);
  });

  it("keeps sprite draw calls in logical coordinates on a portrait viewport", () => {
    vi.stubGlobal("window", { devicePixelRatio: 1 });

    const context = new FakeCanvasContext();
    const canvas = createFakeCanvas(context, {
      clientWidth: 360,
      clientHeight: 720
    });
    const renderer = createCanvasRenderer(canvas);
    const state = {
      ...createPlayingState(),
      invaders: [],
      projectiles: []
    };

    renderer.render(state, {
      bootstrapping: false,
      highScore: 0,
      audioStatus: "ready"
    });

    expect(getPlayerShipFillRects(context, state)).toHaveLength(PLAYER_SHIP_PIXEL_COUNT);
  });

  it("renders the HUD score, wave, and one ship glyph per remaining life", () => {
    vi.stubGlobal("window", { devicePixelRatio: 1 });

    const context = new FakeCanvasContext();
    const canvas = createFakeCanvas(context);
    const renderer = createCanvasRenderer(canvas);
    const state = {
      ...createPlayingState({
        lives: 3,
        score: 120,
        wave: 2
      }),
      invaders: [],
      projectiles: []
    };

    renderer.render(state, {
      bootstrapping: false,
      highScore: 360,
      audioStatus: "ready"
    });

    expect(
      context.fillTextCalls.some(
        (call) =>
          call.text.startsWith("SCORE ") &&
          call.text.includes(String(state.hud.score))
      )
    ).toBe(true);
    expect(
      context.fillTextCalls.some(
        (call) =>
          call.text.startsWith("WAVE ") &&
          call.text.includes(String(state.hud.wave))
      )
    ).toBe(true);

    const hudLifeFillRects = context.fillRectCalls.filter(
      (call) =>
        typeof call.fillStyle === "string" &&
        HUD_SHIP_COLORS.has(call.fillStyle) &&
        call.y >= HUD_TOP &&
        call.y < HUD_TOP + HUD_HEIGHT
    );
    const uniqueHudXValues = [...new Set(hudLifeFillRects.map((call) => call.x))].sort(
      (left, right) => left - right
    );

    expect(countClusters(uniqueHudXValues)).toBe(state.hud.lives);
  });

  it("renders the persisted high score inside the HUD band", () => {
    vi.stubGlobal("window", { devicePixelRatio: 1 });

    const context = new FakeCanvasContext();
    const canvas = createFakeCanvas(context);
    const renderer = createCanvasRenderer(canvas);
    const highScore = 424242;
    const state = {
      ...createPlayingState(),
      invaders: [],
      projectiles: []
    };

    renderer.render(state, {
      bootstrapping: false,
      highScore,
      audioStatus: "ready"
    });

    expect(
      context.fillTextCalls.some(
        (call) =>
          call.text.startsWith("HIGH ") &&
          call.text.includes(String(highScore)) &&
          call.y >= HUD_TOP &&
          call.y < HUD_TOP + HUD_HEIGHT
      )
    ).toBe(true);
  });

  it("renders distinct badge text for muted and unavailable audio", () => {
    vi.stubGlobal("window", { devicePixelRatio: 1 });

    const state = {
      ...createPlayingState(),
      invaders: [],
      projectiles: []
    };

    const renderTexts = (audioStatus: "ready" | "muted" | "unavailable") => {
      const context = new FakeCanvasContext();
      const canvas = createFakeCanvas(context);
      const renderer = createCanvasRenderer(canvas);

      renderer.render(state, {
        bootstrapping: false,
        highScore: 0,
        audioStatus
      });

      return context.fillTextCalls.map((call) => call.text);
    };

    expect(renderTexts("ready")).not.toContain("Muted");
    expect(renderTexts("ready")).not.toContain("Sound unavailable");
    expect(renderTexts("muted")).toContain("Muted");
    expect(renderTexts("muted")).not.toContain("Sound unavailable");
    expect(renderTexts("unavailable")).toContain("Sound unavailable");
    expect(renderTexts("unavailable")).not.toContain("Muted");
  });

  it("renders the invulnerability halo and blinks the ship off on deterministic off frames", () => {
    vi.stubGlobal("window", { devicePixelRatio: 1 });

    const context = new FakeCanvasContext();
    const canvas = createFakeCanvas(context);
    const renderer = createCanvasRenderer(canvas);
    const state = {
      ...createPlayingState({ elapsedMs: 180 }),
      invaders: [],
      projectiles: [],
      player: {
        ...createPlayingState().player,
        invulnerableUntilMs: 360
      }
    };

    renderer.render(state, {
      bootstrapping: false,
      highScore: 0,
      audioStatus: "ready"
    });

    expect(findPlayerInvulnerabilityHalo(context, state)).toBeDefined();
    expect(getPlayerShipFillRects(context, state)).toHaveLength(0);
  });

  it("renders the normal ship without invulnerability halo artifacts once the timer expires", () => {
    vi.stubGlobal("window", { devicePixelRatio: 1 });

    const context = new FakeCanvasContext();
    const canvas = createFakeCanvas(context);
    const renderer = createCanvasRenderer(canvas);
    const state = {
      ...createPlayingState({ elapsedMs: 360 }),
      invaders: [],
      projectiles: [],
      player: {
        ...createPlayingState().player,
        invulnerableUntilMs: 360
      }
    };

    renderer.render(state, {
      bootstrapping: false,
      highScore: 0,
      audioStatus: "ready"
    });

    expect(findPlayerInvulnerabilityHalo(context, state)).toBeUndefined();
    expect(getPlayerShipFillRects(context, state)).toHaveLength(PLAYER_SHIP_PIXEL_COUNT);
  });

  it("renders the shared control footer", () => {
    vi.stubGlobal("window", { devicePixelRatio: 1 });

    const context = new FakeCanvasContext();
    const canvas = createFakeCanvas(context);
    const renderer = createCanvasRenderer(canvas);
    const state = {
      ...createPlayingState(),
      invaders: [],
      projectiles: []
    };

    renderer.render(state, {
      bootstrapping: false,
      highScore: 0,
      audioStatus: "ready"
    });

    expect(
      context.fillTextCalls.some((call) => call.text === CONTROL_FOOTER)
    ).toBe(true);
  });

  it("renders the shared game-over prompt", () => {
    vi.stubGlobal("window", { devicePixelRatio: 1 });

    const context = new FakeCanvasContext();
    const canvas = createFakeCanvas(context);
    const renderer = createCanvasRenderer(canvas);
    const state = {
      ...createGameState({ phase: "gameOver", score: 440, wave: 3 }),
      invaders: [],
      projectiles: []
    };

    renderer.render(state, {
      bootstrapping: false,
      highScore: 0,
      audioStatus: "ready"
    });

    expect(
      context.fillTextCalls.some((call) => call.text === OVERLAY_PROMPTS.gameOver)
    ).toBe(true);
    expect(
      context.fillTextCalls.some((call) => call.text === "Press Space to Restart")
    ).toBe(false);
  });
});

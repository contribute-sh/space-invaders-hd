import { afterEach, describe, expect, it, vi } from "vitest";

import { createPlayingState } from "../game/state";
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
    getContext: (contextId: string) =>
      contextId === "2d" ? (context as unknown as CanvasRenderingContext2D) : null,
    clientHeight: 0,
    clientWidth: 0,
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
      muted: false
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
      muted: false
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

  it("sizes the backing store and applies a letterboxed viewport transform on wide screens", () => {
    vi.stubGlobal("window", {
      devicePixelRatio: 2,
      innerHeight: 600,
      innerWidth: 1200
    });

    const context = new FakeCanvasContext();
    const canvas = createFakeCanvas(context, {
      clientHeight: 600,
      clientWidth: 1200
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
      muted: false
    });

    expect(canvas.width).toBe(2400);
    expect(canvas.height).toBe(1200);
    expect(canvas.style.width).toBe("1200px");
    expect(canvas.style.height).toBe("600px");
    expect(context.setTransformCalls).toContainEqual([5 / 3, 0, 0, 5 / 3, 400, 0]);
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
      muted: false
    });

    expect(findPlayerInvulnerabilityHalo(context, state)).toBeDefined();
    expect(getPlayerShipFillRects(context, state)).toHaveLength(0);
  });

  it("keeps sprite drawing in logical coordinates on portrait viewports", () => {
    vi.stubGlobal("window", {
      devicePixelRatio: 1,
      innerHeight: 1200,
      innerWidth: 600
    });

    const context = new FakeCanvasContext();
    const canvas = createFakeCanvas(context, {
      clientHeight: 1200,
      clientWidth: 600
    });
    const renderer = createCanvasRenderer(canvas);
    const state = {
      ...createPlayingState({ elapsedMs: 360 }),
      invaders: [],
      projectiles: []
    };

    renderer.render(state, {
      bootstrapping: false,
      highScore: 0,
      muted: false
    });

    expect(context.setTransformCalls).toContainEqual([0.625, 0, 0, 0.625, 0, 375]);
    expect(getPlayerShipFillRects(context, state)).toHaveLength(PLAYER_SHIP_PIXEL_COUNT);
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
      muted: false
    });

    expect(findPlayerInvulnerabilityHalo(context, state)).toBeUndefined();
    expect(getPlayerShipFillRects(context, state)).toHaveLength(PLAYER_SHIP_PIXEL_COUNT);
  });
});

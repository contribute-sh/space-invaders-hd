import { afterEach, describe, expect, it, vi } from "vitest";

import { createPlayingState } from "../game/state";
import { createCanvasRenderer } from "./canvas";
import { PLAYER_SHIP_DESCRIPTOR } from "./sprites";

const HUD_TOP = 18;
const HUD_HEIGHT = 68;
const MUTED_BADGE_TEXT = "Sound unavailable";
const HUD_SHIP_COLORS = new Set(Object.values(PLAYER_SHIP_DESCRIPTOR.palette));

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

class FakeCanvasGradient {
  readonly colorStops: Array<{ color: string; offset: number }> = [];

  addColorStop(offset: number, color: string): void {
    this.colorStops.push({ color, offset });
  }
}

class FakeCanvasContext {
  readonly fillRectCalls: FillRectCall[] = [];
  readonly fillTextCalls: FillTextCall[] = [];

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

  setTransform(): void {}

  stroke(): void {}
}

function createFakeCanvas(context: FakeCanvasContext): HTMLCanvasElement {
  return {
    getContext: (contextId: string) =>
      contextId === "2d" ? (context as unknown as CanvasRenderingContext2D) : null,
    height: 0,
    width: 0
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

  it("renders a muted badge label below the HUD when muted", () => {
    vi.stubGlobal("window", { devicePixelRatio: 1 });

    const context = new FakeCanvasContext();
    const canvas = createFakeCanvas(context);
    const renderer = createCanvasRenderer(canvas);
    const state = createPlayingState();

    renderer.render(state, {
      bootstrapping: false,
      highScore: 0,
      muted: true
    });

    const mutedBadgeCall = context.fillTextCalls.find((call) =>
      call.text.includes(MUTED_BADGE_TEXT)
    );

    expect(mutedBadgeCall).toBeDefined();

    if (mutedBadgeCall === undefined) {
      throw new Error("Expected muted badge label to be rendered.");
    }

    expect(mutedBadgeCall.y).toBe(HUD_TOP + HUD_HEIGHT + 32);
  });

  it("does not render a muted badge label when muted is false", () => {
    vi.stubGlobal("window", { devicePixelRatio: 1 });

    const context = new FakeCanvasContext();
    const canvas = createFakeCanvas(context);
    const renderer = createCanvasRenderer(canvas);
    const state = createPlayingState();

    renderer.render(state, {
      bootstrapping: false,
      highScore: 0,
      muted: false
    });

    expect(
      context.fillTextCalls.some((call) => call.text.includes(MUTED_BADGE_TEXT))
    ).toBe(false);
  });
});

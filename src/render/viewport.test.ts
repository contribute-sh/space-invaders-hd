import { describe, expect, it } from "vitest";

import {
  applyViewport,
  computeViewport,
  type Viewport
} from "./viewport";

type FakeWindow = {
  devicePixelRatio?: number;
  innerHeight: number;
  innerWidth: number;
};

type FakeCanvas = {
  clientHeight: number;
  clientWidth: number;
};

type SetTransformCall = [number, number, number, number, number, number];

class FakeViewportContext {
  readonly canvas = {
    height: 0,
    width: 0
  };

  readonly setTransformCalls: SetTransformCall[] = [];

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
}

function createFakeWindow(overrides: Partial<FakeWindow> = {}): FakeWindow {
  return {
    innerWidth: 0,
    innerHeight: 0,
    ...overrides
  };
}

function createFakeCanvas(overrides: Partial<FakeCanvas> = {}): FakeCanvas {
  return {
    clientWidth: 0,
    clientHeight: 0,
    ...overrides
  };
}

describe("computeViewport", () => {
  it("defaults the DPR to 1 and keeps a matching aspect ratio unletterboxed", () => {
    const viewport = computeViewport(
      createFakeWindow({
        innerWidth: 1920,
        innerHeight: 1080
      }),
      createFakeCanvas({
        clientWidth: 1280,
        clientHeight: 720
      }),
      320,
      180
    );

    expect(viewport).toEqual({
      cssWidth: 1280,
      cssHeight: 720,
      backingWidth: 1280,
      backingHeight: 720,
      scale: 4,
      offsetX: 0,
      offsetY: 0
    });
  });

  it("computes a DPR-2 viewport for a square CSS area", () => {
    const viewport = computeViewport(
      createFakeWindow({
        devicePixelRatio: 2,
        innerWidth: 900,
        innerHeight: 900
      }),
      createFakeCanvas({
        clientWidth: 900,
        clientHeight: 900
      }),
      320,
      180
    );

    expect(viewport.cssWidth).toBe(900);
    expect(viewport.cssHeight).toBe(900);
    expect(viewport.backingWidth).toBe(1800);
    expect(viewport.backingHeight).toBe(1800);
    expect(viewport.scale).toBeCloseTo(2.8125);
    expect(viewport.offsetX).toBe(0);
    expect(viewport.offsetY).toBeCloseTo(196.875);
  });

  it("computes a DPR-3 viewport for a wide CSS area", () => {
    const viewport = computeViewport(
      createFakeWindow({
        devicePixelRatio: 3,
        innerWidth: 1200,
        innerHeight: 600
      }),
      createFakeCanvas({
        clientWidth: 1200,
        clientHeight: 600
      }),
      320,
      180
    );

    expect(viewport.cssWidth).toBe(1200);
    expect(viewport.cssHeight).toBe(600);
    expect(viewport.backingWidth).toBe(3600);
    expect(viewport.backingHeight).toBe(1800);
    expect(viewport.scale).toBeCloseTo(10 / 3);
    expect(viewport.offsetX).toBeCloseTo(200 / 3);
    expect(viewport.offsetY).toBe(0);
  });

  it("computes a viewport for a tall CSS area", () => {
    const viewport = computeViewport(
      createFakeWindow({
        devicePixelRatio: 3,
        innerWidth: 600,
        innerHeight: 1200
      }),
      createFakeCanvas({
        clientWidth: 600,
        clientHeight: 1200
      }),
      320,
      180
    );

    expect(viewport.cssWidth).toBe(600);
    expect(viewport.cssHeight).toBe(1200);
    expect(viewport.backingWidth).toBe(1800);
    expect(viewport.backingHeight).toBe(3600);
    expect(viewport.scale).toBeCloseTo(1.875);
    expect(viewport.offsetX).toBe(0);
    expect(viewport.offsetY).toBeCloseTo(431.25);
  });

  it("falls back to the window size when the canvas CSS size is zero", () => {
    const viewport = computeViewport(
      createFakeWindow({
        devicePixelRatio: 2,
        innerWidth: 1024,
        innerHeight: 768
      }),
      createFakeCanvas(),
      320,
      240
    );

    expect(viewport).toEqual({
      cssWidth: 1024,
      cssHeight: 768,
      backingWidth: 2048,
      backingHeight: 1536,
      scale: 3.2,
      offsetX: 0,
      offsetY: 0
    });
  });

  it("prefers the canvas client size over the window size when available", () => {
    const viewport = computeViewport(
      createFakeWindow({
        devicePixelRatio: 2,
        innerWidth: 4000,
        innerHeight: 4000
      }),
      createFakeCanvas({
        clientWidth: 640,
        clientHeight: 360
      }),
      320,
      180
    );

    expect(viewport.cssWidth).toBe(640);
    expect(viewport.cssHeight).toBe(360);
    expect(viewport.backingWidth).toBe(1280);
    expect(viewport.backingHeight).toBe(720);
    expect(viewport.scale).toBe(2);
    expect(viewport.offsetX).toBe(0);
    expect(viewport.offsetY).toBe(0);
  });

  it("rounds CSS and backing dimensions to integers", () => {
    const viewport = computeViewport(
      createFakeWindow({
        devicePixelRatio: 1.5,
        innerWidth: 500,
        innerHeight: 500
      }),
      createFakeCanvas({
        clientWidth: 100.4,
        clientHeight: 50.6
      }),
      10,
      10
    );

    expect(viewport.cssWidth).toBe(100);
    expect(viewport.cssHeight).toBe(51);
    expect(viewport.backingWidth).toBe(150);
    expect(viewport.backingHeight).toBe(77);
    expect(viewport.scale).toBeCloseTo(5.1);
    expect(viewport.offsetX).toBeCloseTo(24.5);
    expect(viewport.offsetY).toBe(0);
  });
});

describe("applyViewport", () => {
  it("sets the backing size and applies a DPR-scaled transform", () => {
    const context = new FakeViewportContext();
    const viewport: Viewport = {
      cssWidth: 640,
      cssHeight: 360,
      backingWidth: 1280,
      backingHeight: 720,
      scale: 2,
      offsetX: 10,
      offsetY: 20
    };

    applyViewport(context, viewport);

    expect(context.canvas.width).toBe(1280);
    expect(context.canvas.height).toBe(720);
    expect(context.setTransformCalls).toEqual([[4, 0, 0, 4, 20, 40]]);
  });

  it("falls back to a DPR of 1 when cssWidth is zero", () => {
    const context = new FakeViewportContext();
    const viewport: Viewport = {
      cssWidth: 0,
      cssHeight: 240,
      backingWidth: 0,
      backingHeight: 240,
      scale: 1.5,
      offsetX: 8,
      offsetY: 12
    };

    applyViewport(context, viewport);

    expect(context.canvas.width).toBe(0);
    expect(context.canvas.height).toBe(240);
    expect(context.setTransformCalls).toEqual([[1.5, 0, 0, 1.5, 8, 12]]);
  });
});

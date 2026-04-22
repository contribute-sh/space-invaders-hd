import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createFixedStepLoop,
  type FixedStepLoop,
  type FixedStepLoopStepInput
} from "./fixedStep";

type ScheduledFrame = (timestamp: number) => void;

type LoopHarness = {
  loop: FixedStepLoop;
  renderCalls: number[];
  runFrame: (advanceMs: number) => void;
  setHidden: (nextHidden: boolean) => void;
  stepCalls: FixedStepLoopStepInput[];
};

function createLoopHarness(stepMs = 10): LoopHarness {
  const scheduledFrames: ScheduledFrame[] = [];
  const stepCalls: FixedStepLoopStepInput[] = [];
  const renderCalls: number[] = [];
  let hidden = false;

  const loop = createFixedStepLoop({
    stepMs,
    now: () => Date.now(),
    schedule: (callback) => {
      scheduledFrames.push(callback);
      return scheduledFrames.length;
    },
    isHidden: () => hidden,
    onStep: (input) => {
      stepCalls.push(input);
    },
    onRender: () => {
      renderCalls.push(Date.now());
    }
  });

  const runFrame = (advanceMs: number): void => {
    vi.advanceTimersByTime(advanceMs);
    const callback = scheduledFrames.shift();

    if (callback === undefined) {
      throw new Error("Expected a scheduled frame.");
    }

    callback(Date.now());
  };

  return {
    loop,
    renderCalls,
    runFrame,
    setHidden: (nextHidden) => {
      hidden = nextHidden;
    },
    stepCalls
  };
}

describe("createFixedStepLoop", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("runs exactly one fixed step when frames advance by stepMs", () => {
    const harness = createLoopHarness();

    harness.loop.start();
    harness.runFrame(10);
    harness.runFrame(10);
    harness.runFrame(10);

    expect(harness.stepCalls).toEqual([
      { dtMs: 10, firstStepOfFrame: true },
      { dtMs: 10, firstStepOfFrame: true },
      { dtMs: 10, firstStepOfFrame: true }
    ]);
    expect(harness.renderCalls).toEqual([10, 20, 30]);
  });

  it("runs catch-up steps for a long frame", () => {
    const harness = createLoopHarness();

    harness.loop.start();
    harness.runFrame(35);

    expect(harness.stepCalls).toEqual([
      { dtMs: 10, firstStepOfFrame: true },
      { dtMs: 10, firstStepOfFrame: false },
      { dtMs: 10, firstStepOfFrame: false }
    ]);
    expect(harness.renderCalls).toEqual([35]);
  });

  it("caps catch-up work with the 100ms spiral-of-death clamp", () => {
    const harness = createLoopHarness();

    harness.loop.start();
    harness.runFrame(1_000);

    expect(harness.stepCalls).toHaveLength(10);
    expect(harness.stepCalls[0]).toEqual({
      dtMs: 10,
      firstStepOfFrame: true
    });
    expect(harness.stepCalls[9]).toEqual({
      dtMs: 10,
      firstStepOfFrame: false
    });
    expect(harness.renderCalls).toEqual([1_000]);
  });

  it("pauses while hidden and resumes without a catch-up burst", () => {
    const harness = createLoopHarness();

    harness.loop.start();
    harness.runFrame(10);

    harness.setHidden(true);
    harness.runFrame(50);
    harness.runFrame(50);

    expect(harness.stepCalls).toEqual([
      { dtMs: 10, firstStepOfFrame: true }
    ]);
    expect(harness.renderCalls).toEqual([10]);

    harness.setHidden(false);
    harness.runFrame(50);

    expect(harness.stepCalls).toEqual([
      { dtMs: 10, firstStepOfFrame: true }
    ]);
    expect(harness.renderCalls).toEqual([10, 160]);

    harness.runFrame(10);

    expect(harness.stepCalls).toEqual([
      { dtMs: 10, firstStepOfFrame: true },
      { dtMs: 10, firstStepOfFrame: true }
    ]);
    expect(harness.renderCalls).toEqual([10, 160, 170]);
  });

  it("marks only the first step in each frame as firstStepOfFrame", () => {
    const harness = createLoopHarness();

    harness.loop.start();
    harness.runFrame(25);
    harness.runFrame(20);

    expect(harness.stepCalls.map((call) => call.firstStepOfFrame)).toEqual([
      true,
      false,
      true,
      false
    ]);
  });
});

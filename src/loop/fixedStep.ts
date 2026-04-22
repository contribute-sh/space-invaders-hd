const MAX_FRAME_DELTA_MS = 100;

type ScheduledFrame = (timestamp: number) => void;

export type FixedStepLoopStepInput = {
  dtMs: number;
  firstStepOfFrame: boolean;
};

export type FixedStepLoop = {
  start: () => void;
  stop: () => void;
};

export type FixedStepLoopOptions = {
  stepMs: number;
  onStep: (input: FixedStepLoopStepInput) => void;
  onRender: () => void;
  now?: () => number;
  schedule?: (callback: ScheduledFrame) => number;
  isHidden?: () => boolean;
};

export function createFixedStepLoop({
  stepMs,
  onStep,
  onRender,
  now = () => performance.now(),
  schedule = requestAnimationFrame,
  isHidden = () => document.hidden
}: FixedStepLoopOptions): FixedStepLoop {
  let accumulator = 0;
  let previousTimestamp: number | null = null;
  let running = false;

  const scheduleNextFrame = (): void => {
    if (running) {
      schedule(tick);
    }
  };

  const resetTiming = (): void => {
    accumulator = 0;
    previousTimestamp = null;
  };

  const tick = (timestamp: number): void => {
    if (!running) {
      return;
    }

    if (isHidden()) {
      resetTiming();
      scheduleNextFrame();
      return;
    }

    if (previousTimestamp === null) {
      previousTimestamp = timestamp;
      onRender();
      scheduleNextFrame();
      return;
    }

    const delta = Math.min(MAX_FRAME_DELTA_MS, timestamp - previousTimestamp);
    previousTimestamp = timestamp;
    accumulator += delta;

    let firstStepOfFrame = true;
    while (accumulator >= stepMs) {
      onStep({
        dtMs: stepMs,
        firstStepOfFrame
      });
      accumulator -= stepMs;
      firstStepOfFrame = false;
    }

    onRender();
    scheduleNextFrame();
  };

  return {
    start: () => {
      if (running) {
        return;
      }

      accumulator = 0;
      previousTimestamp = now();
      running = true;
      scheduleNextFrame();
    },
    stop: () => {
      running = false;
      resetTiming();
    }
  };
}

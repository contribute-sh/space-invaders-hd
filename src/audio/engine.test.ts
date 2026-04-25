import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock
} from "vitest";

import {
  createAudioEngine,
  type AudioContextLike,
  type AudioDestinationLike,
  type AudioGainNodeLike,
  type AudioOscillatorNodeLike,
  type ScheduleToneOptions
} from "./engine";

type MockDestination = {
  readonly kind: "destination";
};

type MockAudioParam = {
  value: number;
  setValueAtTime: Mock<(value: number, time: number) => MockAudioParam>;
  exponentialRampToValueAtTime: Mock<
    (value: number, time: number) => MockAudioParam
  >;
};

type MockGainNode = {
  gain: MockAudioParam;
  connect: Mock<(target: AudioDestinationLike) => unknown>;
} & AudioGainNodeLike;

type MockOscillatorNode = {
  type: OscillatorType;
  frequency: MockAudioParam;
  connect: Mock<(target: AudioGainNodeLike) => unknown>;
  start: Mock<(time: number) => void>;
  stop: Mock<(time: number) => void>;
} & AudioOscillatorNodeLike;

type MockAudioContext = {
  state: AudioContextState;
  readonly destination: MockDestination;
  currentTime: number;
  readonly resume: Mock<() => Promise<void>>;
  readonly createOscillator: Mock<() => MockOscillatorNode>;
  readonly createGain: Mock<() => MockGainNode>;
} & AudioContextLike;

type MockWebAudioHarness = {
  failOnCreate: boolean;
  failOnResume: boolean;
  initialState: AudioContextState;
  readonly destination: MockDestination;
  readonly contexts: MockAudioContext[];
  readonly oscillators: MockOscillatorNode[];
  readonly gains: MockGainNode[];
  readonly createContext: Mock<() => MockAudioContext>;
};

let harness: MockWebAudioHarness;

function createMockAudioParam(initialValue: number): MockAudioParam {
  const audioParam: MockAudioParam = {
    value: initialValue,
    setValueAtTime: vi.fn<(value: number, time: number) => MockAudioParam>(),
    exponentialRampToValueAtTime:
      vi.fn<(value: number, time: number) => MockAudioParam>()
  };

  audioParam.setValueAtTime.mockImplementation((value) => {
    audioParam.value = value;
    return audioParam;
  });
  audioParam.exponentialRampToValueAtTime.mockImplementation((value) => {
    audioParam.value = value;
    return audioParam;
  });

  return audioParam;
}

function createMockWebAudioHarness(
  initialState: AudioContextState = "suspended"
): MockWebAudioHarness {
  const destination: MockDestination = { kind: "destination" };
  const contexts: MockAudioContext[] = [];
  const oscillators: MockOscillatorNode[] = [];
  const gains: MockGainNode[] = [];

  const harness: MockWebAudioHarness = {
    failOnCreate: false,
    failOnResume: false,
    initialState,
    destination,
    contexts,
    oscillators,
    gains,
    createContext: vi.fn<() => MockAudioContext>()
  };

  harness.createContext.mockImplementation(() => {
    if (harness.failOnCreate) {
      throw new Error("AudioContext unavailable");
    }

    const context: MockAudioContext = {
      state: harness.initialState,
      destination,
      currentTime: 0,
      resume: vi.fn(async () => {
        if (harness.failOnResume) {
          throw new Error("Resume failed");
        }

        context.state = "running";
      }),
      createOscillator: vi.fn(() => {
        const oscillator: MockOscillatorNode = {
          type: "sine",
          frequency: createMockAudioParam(0),
          connect: vi.fn((target: AudioGainNodeLike) => target),
          start: vi.fn<(time: number) => void>(),
          stop: vi.fn<(time: number) => void>()
        };

        oscillators.push(oscillator);

        return oscillator;
      }),
      createGain: vi.fn(() => {
        const gain: MockGainNode = {
          gain: createMockAudioParam(0),
          connect: vi.fn((target: AudioDestinationLike) => target)
        };

        gains.push(gain);

        return gain;
      })
    };

    contexts.push(context);

    return context;
  });

  return harness;
}

function getLastContext(mockHarness: MockWebAudioHarness): MockAudioContext {
  const context = mockHarness.contexts.at(-1);

  if (context === undefined) {
    throw new Error("Expected an AudioContext instance.");
  }

  return context;
}

describe("createAudioEngine", () => {
  beforeEach(() => {
    harness = createMockWebAudioHarness();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("arms a suspended context once and reuses it across repeated arm calls", async () => {
    const engine = createAudioEngine({ createContext: harness.createContext });

    await engine.arm();
    await engine.arm();

    expect(harness.createContext).toHaveBeenCalledTimes(1);

    const context = getLastContext(harness);

    expect(context.resume).toHaveBeenCalledTimes(1);
    expect(context.state).toBe("running");
    expect(engine.getStatus()).toBe("ready");
  });

  it("resumes a suspended context during arm and reports ready", async () => {
    const suspendedHarness = createMockWebAudioHarness("suspended");
    const engine = createAudioEngine({
      createContext: suspendedHarness.createContext
    });

    await engine.arm();

    const context = getLastContext(suspendedHarness);

    expect(context.resume).toHaveBeenCalledTimes(1);
    expect(engine.getStatus()).toBe("ready");
  });

  it("skips resume for a running context during arm and reports ready", async () => {
    const runningHarness = createMockWebAudioHarness("running");
    const engine = createAudioEngine({
      createContext: runningHarness.createContext
    });

    await engine.arm();

    const context = getLastContext(runningHarness);

    expect(context.resume).toHaveBeenCalledTimes(0);
    expect(engine.getStatus()).toBe("ready");
  });

  it.each([
    {
      label: "context construction fails",
      prepare: (mockHarness: MockWebAudioHarness) => {
        mockHarness.failOnCreate = true;
      }
    },
    {
      label: "context resume fails",
      prepare: (mockHarness: MockWebAudioHarness) => {
        mockHarness.failOnResume = true;
      }
    }
  ])("reports muted when $label", async ({ prepare }) => {
    prepare(harness);
    const engine = createAudioEngine({ createContext: harness.createContext });

    await engine.arm();

    expect(engine.getStatus()).toBe("muted");
  });

  it("retries arming after an initial context creation failure", async () => {
    const createContext = vi
      .fn<() => MockAudioContext>()
      .mockImplementationOnce(() => {
        throw new Error("AudioContext unavailable");
      })
      .mockImplementation(() => harness.createContext());
    const engine = createAudioEngine({ createContext });

    await engine.arm();

    expect(engine.getStatus()).not.toBe("ready");
    expect(harness.contexts).toHaveLength(0);

    await engine.arm();

    expect(engine.getStatus()).toBe("ready");

    const context = getLastContext(harness);

    engine.scheduleTone({
      frequency: 440,
      duration: 0.1,
      gain: 0.06,
      type: "square"
    });

    expect(context.createOscillator).toHaveBeenCalledTimes(1);
  });

  it("does not schedule anything while idle or muted", async () => {
    const idleEngine = createAudioEngine({ createContext: harness.createContext });

    idleEngine.scheduleTone({
      frequency: 440,
      duration: 0.1,
      gain: 0.06,
      type: "square"
    });

    expect(harness.contexts).toHaveLength(0);
    expect(harness.oscillators).toHaveLength(0);
    expect(harness.gains).toHaveLength(0);

    const mutedEngine = createAudioEngine({ createContext: harness.createContext });
    await mutedEngine.arm();
    mutedEngine.setMuted(true);
    mutedEngine.scheduleTone({
      frequency: 660,
      duration: 0.08,
      gain: 0.04,
      type: "triangle"
    });

    expect(mutedEngine.getStatus()).toBe("muted");
    expect(harness.oscillators).toHaveLength(0);
    expect(harness.gains).toHaveLength(0);
  });

  it("lets muted status override ready until scheduling is explicitly re-enabled", async () => {
    const engine = createAudioEngine({ createContext: harness.createContext });
    const toneOptions: ScheduleToneOptions = {
      frequency: 660,
      duration: 0.08,
      gain: 0.04,
      type: "triangle"
    };

    await engine.arm();

    const context = getLastContext(harness);

    expect(engine.getStatus()).toBe("ready");

    context.createOscillator.mockClear();
    context.createGain.mockClear();

    engine.setMuted(true);

    expect(engine.getStatus()).toBe("muted");

    engine.scheduleTone(toneOptions);

    expect(context.createOscillator).not.toHaveBeenCalled();
    expect(context.createGain).not.toHaveBeenCalled();

    engine.setMuted(false);

    expect(engine.getStatus()).toBe("ready");

    engine.scheduleTone(toneOptions);

    expect(context.createOscillator).toHaveBeenCalledTimes(1);
    expect(context.createGain).toHaveBeenCalledTimes(1);
  });

  it("restores scheduling after unmuting from a muted ready state", async () => {
    const engine = createAudioEngine({ createContext: harness.createContext });
    const toneOptions: ScheduleToneOptions = {
      frequency: 660,
      duration: 0.08,
      gain: 0.04,
      type: "triangle"
    };

    await engine.arm();

    const context = getLastContext(harness);

    expect(engine.getStatus()).toBe("ready");

    engine.setMuted(true);
    engine.scheduleTone(toneOptions);

    expect(context.createOscillator).not.toHaveBeenCalled();
    expect(context.createGain).not.toHaveBeenCalled();

    context.createOscillator.mockClear();
    context.createGain.mockClear();

    engine.setMuted(false);
    engine.scheduleTone(toneOptions);

    expect(engine.getStatus()).toBe("ready");
    expect(context.createOscillator).toHaveBeenCalledTimes(1);
    expect(context.createGain).toHaveBeenCalledTimes(1);

    const oscillator = harness.oscillators[0];

    if (oscillator === undefined) {
      throw new Error("Expected an oscillator after unmuting.");
    }

    expect(oscillator.start).toHaveBeenCalledTimes(1);
    expect(oscillator.stop).toHaveBeenCalledTimes(1);
  });

  it("schedules oscillator playback through a gain envelope", async () => {
    const engine = createAudioEngine({ createContext: harness.createContext });
    await engine.arm();

    const context = getLastContext(harness);

    context.currentTime = 12;
    engine.scheduleTone({
      frequency: 880,
      duration: 0.25,
      gain: 0.08,
      type: "sawtooth",
      startOffset: 0.1
    });

    const oscillator = harness.oscillators[0];
    const gain = harness.gains[0];

    if (oscillator === undefined || gain === undefined) {
      throw new Error("Expected a scheduled oscillator and gain node.");
    }

    expect(engine.now()).toBe(12);
    expect(oscillator.type).toBe("sawtooth");
    expect(oscillator.connect).toHaveBeenCalledWith(gain);
    expect(gain.connect).toHaveBeenCalledWith(harness.destination);
    expect(oscillator.frequency.setValueAtTime).toHaveBeenCalledWith(880, 12.1);
    expect(gain.gain.setValueAtTime).toHaveBeenCalledWith(0.0001, 12.1);

    const attackCall = gain.gain.exponentialRampToValueAtTime.mock.calls[0];
    const releaseCall = gain.gain.exponentialRampToValueAtTime.mock.calls[1];
    const startCall = oscillator.start.mock.calls[0];
    const stopCall = oscillator.stop.mock.calls[0];

    if (
      attackCall === undefined ||
      releaseCall === undefined ||
      startCall === undefined ||
      stopCall === undefined
    ) {
      throw new Error("Expected scheduled gain ramps and playback times.");
    }

    expect(attackCall[0]).toBe(0.08);
    expect(attackCall[1]).toBeCloseTo(12.12);
    expect(releaseCall[0]).toBe(0.0001);
    expect(releaseCall[1]).toBeCloseTo(12.35);
    expect(startCall[0]).toBeCloseTo(12.1);
    expect(stopCall[0]).toBeCloseTo(12.37);
  });

  it("suppresses rapid repeats when a cooldown tag is reused", async () => {
    const engine = createAudioEngine({ createContext: harness.createContext });
    await engine.arm();

    const context = getLastContext(harness);

    context.currentTime = 3;
    engine.scheduleTone({
      tag: "shoot",
      cooldownSeconds: 0.25,
      frequency: 720,
      duration: 0.09,
      gain: 0.06,
      type: "square"
    });

    expect(context.createOscillator).toHaveBeenCalledTimes(1);
    expect(context.createGain).toHaveBeenCalledTimes(1);

    context.currentTime += 0.1;
    engine.scheduleTone({
      tag: "shoot",
      cooldownSeconds: 0.25,
      frequency: 720,
      duration: 0.09,
      gain: 0.06,
      type: "square"
    });

    expect(context.createOscillator).toHaveBeenCalledTimes(1);
    expect(context.createGain).toHaveBeenCalledTimes(1);

    context.currentTime += 0.2;
    engine.scheduleTone({
      tag: "shoot",
      cooldownSeconds: 0.25,
      frequency: 720,
      duration: 0.09,
      gain: 0.06,
      type: "square"
    });

    expect(context.createOscillator).toHaveBeenCalledTimes(2);
    expect(context.createGain).toHaveBeenCalledTimes(2);
  });

  it("applies cooldown suppression independently for each scheduleTone tag", async () => {
    const engine = createAudioEngine({ createContext: harness.createContext });
    await engine.arm();

    const context = getLastContext(harness);
    const cooldownSeconds = 0.05;

    context.currentTime = 1;
    engine.scheduleTone({
      tag: "shoot",
      cooldownSeconds,
      frequency: 720,
      duration: 0.09,
      gain: 0.06,
      type: "square"
    });
    engine.scheduleTone({
      tag: "shoot",
      cooldownSeconds,
      frequency: 720,
      duration: 0.09,
      gain: 0.06,
      type: "square"
    });

    expect(context.createOscillator).toHaveBeenCalledTimes(1);

    context.currentTime += cooldownSeconds + 0.001;
    engine.scheduleTone({
      tag: "shoot",
      cooldownSeconds,
      frequency: 720,
      duration: 0.09,
      gain: 0.06,
      type: "square"
    });

    expect(context.createOscillator).toHaveBeenCalledTimes(2);

    context.currentTime = 2;
    engine.scheduleTone({
      tag: "shoot",
      cooldownSeconds,
      frequency: 720,
      duration: 0.09,
      gain: 0.06,
      type: "square"
    });

    const createOscillatorCallsAfterShoot = context.createOscillator.mock.calls.length;

    engine.scheduleTone({
      tag: "hit",
      cooldownSeconds,
      frequency: 720,
      duration: 0.09,
      gain: 0.06,
      type: "square"
    });

    expect(context.createOscillator).toHaveBeenCalledTimes(
      createOscillatorCallsAfterShoot + 1
    );
  });
});

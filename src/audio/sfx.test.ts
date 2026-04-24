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
  type AudioEngine,
  type AudioEngineStatus,
  type ScheduleToneOptions
} from "./engine";
import { createSfxController, type SfxName } from "./sfx";

type MockDestination = {
  readonly kind: "destination";
};

type MockAudioParam = {
  value: number;
  setValueAtTime: Mock<(value: number, time: number) => MockAudioParam>;
  linearRampToValueAtTime: Mock<
    (value: number, time: number) => MockAudioParam
  >;
  exponentialRampToValueAtTime: Mock<
    (value: number, time: number) => MockAudioParam
  >;
};

type MockOscillatorNode = {
  type: OscillatorType;
  frequency: MockAudioParam;
  connect: Mock<(target: MockGainNode) => MockGainNode>;
  start: Mock<(time: number) => void>;
  stop: Mock<(time: number) => void>;
};

type MockGainNode = {
  gain: MockAudioParam;
  connect: Mock<(target: MockDestination) => MockDestination>;
};

type MockAudioContext = {
  state: AudioContextState;
  readonly destination: MockDestination;
  currentTime: number;
  readonly resume: Mock<() => Promise<void>>;
  readonly createOscillator: Mock<() => MockOscillatorNode>;
  readonly createGain: Mock<() => MockGainNode>;
};

type MockPlayback = {
  oscillators: MockOscillatorNode[];
  gains: MockGainNode[];
  frequencies: number[];
  startTimes: number[];
  stopTimes: number[];
  totalDuration: number;
};

type MockWebAudioHarness = {
  initialState: AudioContextState;
  throwOnAudioContextConstruction: boolean;
  throwOnResume: boolean;
  readonly destination: MockDestination;
  readonly contexts: MockAudioContext[];
  readonly oscillators: MockOscillatorNode[];
  readonly gains: MockGainNode[];
  readonly audioContextConstructor: Mock<() => MockAudioContext>;
  readonly oscillatorConstructor: Mock<() => MockOscillatorNode>;
  readonly gainConstructor: Mock<() => MockGainNode>;
};

type MockAudioEngine = {
  readonly engine: AudioEngine;
  readonly arm: Mock<() => Promise<void>>;
  readonly getStatus: Mock<() => AudioEngineStatus>;
  readonly now: Mock<() => number>;
  readonly scheduleTone: Mock<(options: ScheduleToneOptions) => void>;
  readonly setMuted: Mock<(muted: boolean) => void>;
  setStatus: (status: AudioEngineStatus) => void;
};

type MockOscillatorConstructor = new () => MockOscillatorNode;
type MockGainConstructor = new () => MockGainNode;

const SFX_NAMES = [
  "shoot",
  "hit",
  "playerDeath",
  "waveClear"
] as const satisfies readonly SfxName[];
const AFTER_SFX_COOLDOWN_SECONDS = 0.031;

let harness: MockWebAudioHarness;

function createMockEngine(
  initialStatus: AudioEngineStatus = "ready"
): MockAudioEngine {
  let status = initialStatus;
  const arm: Mock<() => Promise<void>> = vi.fn(async () => {});
  const getStatus: Mock<() => AudioEngineStatus> = vi.fn(() => status);
  const now: Mock<() => number> = vi.fn(() => 0);
  const scheduleTone: Mock<(options: ScheduleToneOptions) => void> = vi.fn();
  const setMuted: Mock<(muted: boolean) => void> = vi.fn();

  return {
    engine: {
      arm,
      getStatus,
      now,
      scheduleTone,
      setMuted
    },
    arm,
    getStatus,
    now,
    scheduleTone,
    setMuted,
    setStatus: (nextStatus) => {
      status = nextStatus;
    }
  };
}

function createMockAudioParam(initialValue: number): MockAudioParam {
  const audioParam: MockAudioParam = {
    value: initialValue,
    setValueAtTime: vi.fn<(value: number, time: number) => MockAudioParam>(),
    linearRampToValueAtTime:
      vi.fn<(value: number, time: number) => MockAudioParam>(),
    exponentialRampToValueAtTime:
      vi.fn<(value: number, time: number) => MockAudioParam>()
  };

  audioParam.setValueAtTime.mockImplementation((value) => {
    audioParam.value = value;
    return audioParam;
  });
  audioParam.linearRampToValueAtTime.mockImplementation((value) => {
    audioParam.value = value;
    return audioParam;
  });
  audioParam.exponentialRampToValueAtTime.mockImplementation((value) => {
    audioParam.value = value;
    return audioParam;
  });

  return audioParam;
}

function installMockWebAudio(
  initialState: AudioContextState = "suspended"
): MockWebAudioHarness {
  const destination: MockDestination = { kind: "destination" };
  const contexts: MockAudioContext[] = [];
  const oscillators: MockOscillatorNode[] = [];
  const gains: MockGainNode[] = [];

  const oscillatorConstructor = vi.fn(function MockOscillatorNodeCtor() {
    const oscillator: MockOscillatorNode = {
      type: "sine",
      frequency: createMockAudioParam(0),
      connect: vi.fn((target: MockGainNode) => target),
      start: vi.fn<(time: number) => void>(),
      stop: vi.fn<(time: number) => void>()
    };

    oscillators.push(oscillator);

    return oscillator;
  });

  const gainConstructor = vi.fn(function MockGainNodeCtor() {
    const gain: MockGainNode = {
      gain: createMockAudioParam(0),
      connect: vi.fn((target: MockDestination) => target)
    };

    gains.push(gain);

    return gain;
  });

  const harness: MockWebAudioHarness = {
    initialState,
    throwOnAudioContextConstruction: false,
    throwOnResume: false,
    destination,
    contexts,
    oscillators,
    gains,
    audioContextConstructor: vi.fn<() => MockAudioContext>(),
    oscillatorConstructor,
    gainConstructor
  };

  harness.audioContextConstructor.mockImplementation(
    function MockAudioContextCtor() {
      if (harness.throwOnAudioContextConstruction) {
        throw new Error("AudioContext unavailable");
      }

      const context: MockAudioContext = {
        state: harness.initialState,
        destination,
        currentTime: 0,
        resume: vi.fn(async () => {
          if (harness.throwOnResume) {
            throw new Error("AudioContext resume failed");
          }

          context.state = "running";
        }),
        createOscillator: vi.fn(() => {
          const OscillatorCtor =
            globalThis.OscillatorNode as unknown as MockOscillatorConstructor;

          return new OscillatorCtor();
        }),
        createGain: vi.fn(() => {
          const GainCtor =
            globalThis.GainNode as unknown as MockGainConstructor;

          return new GainCtor();
        })
      };

      contexts.push(context);

      return context;
    }
  );

  vi.stubGlobal(
    "OscillatorNode",
    oscillatorConstructor as unknown as typeof OscillatorNode
  );
  vi.stubGlobal("GainNode", gainConstructor as unknown as typeof GainNode);
  vi.stubGlobal(
    "AudioContext",
    harness.audioContextConstructor as unknown as typeof AudioContext
  );

  return harness;
}

function getLastContext(mockHarness: MockWebAudioHarness): MockAudioContext {
  const context = mockHarness.contexts.at(-1);

  if (context === undefined) {
    throw new Error("Expected an AudioContext instance.");
  }

  return context;
}

function getScheduledTone(
  mockEngine: MockAudioEngine,
  callIndex: number
): ScheduleToneOptions {
  const call = mockEngine.scheduleTone.mock.calls[callIndex];

  if (call === undefined) {
    throw new Error(`Expected scheduleTone call ${callIndex}.`);
  }

  const [options] = call;

  return options;
}

function getSingleTimeCall(
  mock: Mock<(time: number) => void>,
  label: string
): number {
  const call = mock.mock.calls[0];

  if (call === undefined) {
    throw new Error(`Expected ${label} to be called.`);
  }

  const [time] = call;

  return time;
}

function getAudioParamCall(
  mock: Mock<(value: number, time: number) => MockAudioParam>,
  label: string
): { value: number; time: number } {
  const call = mock.mock.calls[0];

  if (call === undefined) {
    throw new Error(`Expected ${label} to be called.`);
  }

  const [value, time] = call;

  return { value, time };
}

function capturePlayback(
  mockHarness: MockWebAudioHarness,
  controller: ReturnType<typeof createSfxController>,
  name: SfxName
): MockPlayback {
  const oscillatorStartIndex = mockHarness.oscillators.length;
  const gainStartIndex = mockHarness.gains.length;

  controller.play(name);

  const oscillators = mockHarness.oscillators.slice(oscillatorStartIndex);
  const gains = mockHarness.gains.slice(gainStartIndex);
  const startTimes = oscillators.map((oscillator) =>
    getSingleTimeCall(oscillator.start, "oscillator.start")
  );
  const stopTimes = oscillators.map((oscillator) =>
    getSingleTimeCall(oscillator.stop, "oscillator.stop")
  );
  const frequencies = oscillators.map(
    (oscillator) =>
      getAudioParamCall(
        oscillator.frequency.setValueAtTime,
        "oscillator.frequency.setValueAtTime"
      ).value
  );

  return {
    oscillators,
    gains,
    frequencies,
    startTimes,
    stopTimes,
    totalDuration: Math.max(...stopTimes) - Math.min(...startTimes)
  };
}

function expectScheduledShortBeeps(
  playback: MockPlayback,
  destination: MockDestination
): void {
  expect(playback.oscillators.length).toBeGreaterThan(0);
  expect(playback.gains).toHaveLength(playback.oscillators.length);
  expect(playback.totalDuration).toBeLessThanOrEqual(1.5);

  playback.oscillators.forEach((oscillator, index) => {
    const gain = playback.gains[index];

    if (gain === undefined) {
      throw new Error("Expected a gain node for each oscillator.");
    }

    const startTime = playback.startTimes[index];
    const stopTime = playback.stopTimes[index];

    if (startTime === undefined || stopTime === undefined) {
      throw new Error("Expected scheduled start and stop times.");
    }

    expect(oscillator.connect).toHaveBeenCalledTimes(1);
    expect(oscillator.connect).toHaveBeenCalledWith(gain);
    expect(gain.connect).toHaveBeenCalledTimes(1);
    expect(gain.connect).toHaveBeenCalledWith(destination);
    expect(stopTime).toBeGreaterThan(startTime);

    const frequencyCall = getAudioParamCall(
      oscillator.frequency.setValueAtTime,
      "oscillator.frequency.setValueAtTime"
    );

    expect(frequencyCall.value).toBeGreaterThan(0);
    expect(frequencyCall.time).toBe(startTime);
    expect(oscillator.frequency.value).toBe(frequencyCall.value);

    const gainSetCall = getAudioParamCall(
      gain.gain.setValueAtTime,
      "gain.setValueAtTime"
    );

    expect(gainSetCall.time).toBe(startTime);
    expect(gain.gain.linearRampToValueAtTime).not.toHaveBeenCalled();
    expect(gain.gain.exponentialRampToValueAtTime).toHaveBeenCalledTimes(2);

    const attackCall = gain.gain.exponentialRampToValueAtTime.mock.calls[0];
    const releaseCall = gain.gain.exponentialRampToValueAtTime.mock.calls[1];

    if (attackCall === undefined || releaseCall === undefined) {
      throw new Error("Expected attack and release gain ramps.");
    }

    expect(attackCall[1]).toBeGreaterThan(startTime);
    expect(releaseCall[1]).toBeLessThan(stopTime);
  });
}

describe("createSfxController", () => {
  beforeEach(() => {
    harness = installMockWebAudio();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("returns idle before arming", () => {
    const controller = createSfxController();

    expect(controller.getStatus()).toBe("idle");
  });

  it("forwards arm, getStatus, and setMuted to an injected engine", async () => {
    const mockEngine = createMockEngine("idle");
    const controller = createSfxController(mockEngine.engine);

    expect(controller.getStatus()).toBe("idle");

    mockEngine.setStatus("ready");

    expect(controller.getStatus()).toBe("ready");

    await controller.arm();
    controller.setMuted(true);

    expect(mockEngine.arm).toHaveBeenCalledTimes(1);
    expect(mockEngine.setMuted).toHaveBeenCalledWith(true);
  });

  it("arms the controller, resumes a suspended context, and becomes ready", async () => {
    const controller = createSfxController();

    await controller.arm();

    expect(harness.audioContextConstructor).toHaveBeenCalledTimes(1);

    const context = getLastContext(harness);

    expect(context.resume).toHaveBeenCalledTimes(1);
    expect(context.state).toBe("running");
    expect(controller.getStatus()).toBe("ready");
  });

  it("reports muted when AudioContext construction fails and play becomes a no-op", async () => {
    harness.throwOnAudioContextConstruction = true;

    const controller = createSfxController();

    await controller.arm();
    controller.play("shoot");
    controller.setMuted(true);

    expect(harness.audioContextConstructor).toHaveBeenCalledTimes(1);
    expect(controller.getStatus()).toBe("muted");
    expect(harness.oscillators).toHaveLength(0);
    expect(harness.gains).toHaveLength(0);
  });

  it("reports muted when AudioContext.resume fails and retries with the same context", async () => {
    harness.throwOnResume = true;

    const controller = createSfxController();

    await controller.arm();
    controller.play("shoot");

    expect(harness.audioContextConstructor).toHaveBeenCalledTimes(1);
    expect(controller.getStatus()).toBe("muted");
    expect(harness.oscillators).toHaveLength(0);
    expect(harness.gains).toHaveLength(0);

    harness.throwOnResume = false;
    await controller.arm();

    expect(harness.audioContextConstructor).toHaveBeenCalledTimes(1);
    expect(controller.getStatus()).toBe("ready");
  });

  it.each(["idle", "muted"] as const)(
    "does not call scheduleTone while the injected engine is %s",
    (status) => {
      const mockEngine = createMockEngine(status);
      const controller = createSfxController(mockEngine.engine);

      controller.play("shoot");

      expect(mockEngine.scheduleTone).not.toHaveBeenCalled();
    }
  );

  it("restores playback after the user mute preference is cleared", async () => {
    const controller = createSfxController();

    await controller.arm();
    controller.setMuted(true);

    expect(controller.getStatus()).toBe("muted");

    controller.setMuted(false);

    expect(controller.getStatus()).toBe("ready");

    const playback = capturePlayback(harness, controller, "shoot");

    expectScheduledShortBeeps(playback, harness.destination);
  });

  it("schedules shoot tones through the injected engine with the expected options", () => {
    const mockEngine = createMockEngine();
    const controller = createSfxController(mockEngine.engine);

    controller.play("shoot");

    expect(mockEngine.scheduleTone).toHaveBeenCalledTimes(2);

    const firstTone = getScheduledTone(mockEngine, 0);
    const secondTone = getScheduledTone(mockEngine, 1);

    expect(firstTone).toMatchObject({
      frequency: 720,
      duration: 0.09,
      gain: 0.06,
      type: "square",
      cooldownSeconds: 0.03,
      tag: "shoot:0"
    });
    expect(firstTone.startOffset).toBe(0);

    expect(secondTone).toMatchObject({
      frequency: 940,
      duration: 0.06,
      gain: 0.04,
      type: "triangle",
      cooldownSeconds: 0.03,
      tag: "shoot:1"
    });
    expect(secondTone.startOffset).toBeCloseTo(0.0612);
  });

  it("assigns cooldownSeconds and stable tone tags to every tone in a multi-tone effect", () => {
    const mockEngine = createMockEngine();
    const controller = createSfxController(mockEngine.engine);

    controller.play("playerDeath");

    expect(mockEngine.scheduleTone).toHaveBeenCalledTimes(3);
    expect(
      mockEngine.scheduleTone.mock.calls.map(([options]) => options.cooldownSeconds)
    ).toEqual([0.03, 0.03, 0.03]);
    expect(
      mockEngine.scheduleTone.mock.calls.map(([options]) => options.tag)
    ).toEqual(["playerDeath:0", "playerDeath:1", "playerDeath:2"]);
  });

  it.each(SFX_NAMES)(
    "schedules connected short beeps for %s after arming",
    async (name) => {
      const controller = createSfxController();
      await controller.arm();

      const playback = capturePlayback(harness, controller, name);

      expectScheduledShortBeeps(playback, harness.destination);
    }
  );

  it("suppresses replay of a multi-tone effect inside the cooldown window", async () => {
    const controller = createSfxController();
    await controller.arm();
    const context = getLastContext(harness);

    context.currentTime = 1;
    controller.play("playerDeath");

    const createOscillatorCallsBeforeSecondPlay =
      context.createOscillator.mock.calls.length;

    controller.play("playerDeath");

    expect(
      context.createOscillator.mock.calls.length -
        createOscillatorCallsBeforeSecondPlay
    ).toBe(0);
  });

  it("schedules a multi-tone effect again after the cooldown window elapses", async () => {
    const controller = createSfxController();
    await controller.arm();
    const context = getLastContext(harness);

    context.currentTime = 1;
    const firstPlayback = capturePlayback(harness, controller, "playerDeath");

    context.currentTime += AFTER_SFX_COOLDOWN_SECONDS;
    const secondPlayback = capturePlayback(harness, controller, "playerDeath");

    expect(firstPlayback.oscillators.length).toBe(3);
    expect(secondPlayback.oscillators.length).toBe(firstPlayback.oscillators.length);
    expect(secondPlayback.gains.length).toBe(firstPlayback.gains.length);
    expect(harness.oscillators).toHaveLength(
      firstPlayback.oscillators.length + secondPlayback.oscillators.length
    );
    expect(harness.gains).toHaveLength(
      firstPlayback.gains.length + secondPlayback.gains.length
    );

    firstPlayback.oscillators.forEach((oscillator, index) => {
      expect(secondPlayback.oscillators[index]).not.toBe(oscillator);
    });
    firstPlayback.gains.forEach((gain, index) => {
      expect(secondPlayback.gains[index]).not.toBe(gain);
    });
  });
});

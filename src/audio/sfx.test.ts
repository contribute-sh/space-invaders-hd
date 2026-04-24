import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock
} from "vitest";

import type { AudioEngineStatus, ScheduleToneOptions } from "./engine";
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

type MockSfxEngine = {
  arm: Mock<() => Promise<void>>;
  getStatus: Mock<() => AudioEngineStatus>;
  scheduleTone: Mock<(options: ScheduleToneOptions) => void>;
  setMuted: Mock<(muted: boolean) => void>;
};

type MockOscillatorConstructor = new () => MockOscillatorNode;
type MockGainConstructor = new () => MockGainNode;

const SFX_NAMES = [
  "shoot",
  "hit",
  "playerDeath",
  "waveClear"
] as const satisfies readonly SfxName[];
const SFX_COOLDOWN_SECONDS = 0.03;

let harness: MockWebAudioHarness;

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

function createMockSfxEngine(
  status: AudioEngineStatus = "ready"
): MockSfxEngine {
  return {
    arm: vi.fn(async () => {}),
    getStatus: vi.fn(() => status),
    scheduleTone: vi.fn<(options: ScheduleToneOptions) => void>(),
    setMuted: vi.fn<(muted: boolean) => void>()
  };
}

function getLastContext(mockHarness: MockWebAudioHarness): MockAudioContext {
  const context = mockHarness.contexts.at(-1);

  if (context === undefined) {
    throw new Error("Expected an AudioContext instance.");
  }

  return context;
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

function getScheduledToneCall(
  engine: MockSfxEngine,
  index: number
): ScheduleToneOptions {
  const call = engine.scheduleTone.mock.calls[index];

  if (call === undefined) {
    throw new Error(`Expected scheduleTone call ${index + 1}.`);
  }

  const [options] = call;

  return options;
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

  it("reports muted when AudioContext.resume fails and can recover on a later arm", async () => {
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

  it("reports muted while the user mute preference is enabled, even after arming", async () => {
    const controller = createSfxController();

    controller.setMuted(true);
    await controller.arm();

    expect(harness.audioContextConstructor).toHaveBeenCalledTimes(0);
    expect(controller.getStatus()).toBe("muted");
  });

  it("does not create any nodes while the user mute preference is enabled", async () => {
    const controller = createSfxController();
    await controller.arm();

    controller.setMuted(true);
    controller.play("shoot");

    expect(harness.oscillators).toHaveLength(0);
    expect(harness.gains).toHaveLength(0);
  });

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

  it("does not create any nodes while idle", () => {
    const controller = createSfxController();

    controller.play("shoot");

    expect(harness.oscillators).toHaveLength(0);
    expect(harness.gains).toHaveLength(0);
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

  it("keeps distinct tone patterns across the named SFX", async () => {
    const controller = createSfxController();
    await controller.arm();

    const signatures = new Set(
      SFX_NAMES.map((name) => {
        const playback = capturePlayback(harness, controller, name);

        return JSON.stringify({
          oscillatorCount: playback.oscillators.length,
          frequencies: playback.frequencies,
          totalDuration: Number(playback.totalDuration.toFixed(3))
        });
      })
    );

    expect(signatures.size).toBeGreaterThan(1);
  });

  it("passes the shoot tone pattern through scheduleTone", () => {
    const engine = createMockSfxEngine();
    const controller = createSfxController(engine);

    controller.play("shoot");

    expect(engine.getStatus).toHaveBeenCalledTimes(1);
    expect(engine.scheduleTone).toHaveBeenCalledTimes(2);

    const firstTone = getScheduledToneCall(engine, 0);
    const secondTone = getScheduledToneCall(engine, 1);

    expect(firstTone.frequency).toBe(720);
    expect(firstTone.duration).toBe(0.09);
    expect(firstTone.gain).toBe(0.06);
    expect(firstTone.type).toBe("square");
    expect(firstTone.tag).toBe("shoot");
    expect(firstTone.cooldownSeconds).toBe(SFX_COOLDOWN_SECONDS);
    expect(firstTone.startOffset).toBeUndefined();

    expect(secondTone.frequency).toBe(940);
    expect(secondTone.duration).toBe(0.06);
    expect(secondTone.gain).toBe(0.04);
    expect(secondTone.type).toBe("triangle");
    expect(secondTone.startOffset).toBeCloseTo(0.09 * 0.68);
    expect(secondTone.tag).toBeUndefined();
    expect(secondTone.cooldownSeconds).toBeUndefined();
  });

  it.each(["idle", "muted"] as const)(
    "does not call scheduleTone with an injected engine while %s",
    (status) => {
      const engine = createMockSfxEngine(status);
      const controller = createSfxController(engine);

      controller.play("shoot");

      expect(engine.getStatus).toHaveBeenCalledTimes(1);
      expect(engine.scheduleTone).not.toHaveBeenCalled();
    }
  );

  it("tags only the first tone in a multi-tone effect with cooldown metadata", () => {
    const engine = createMockSfxEngine();
    const controller = createSfxController(engine);

    controller.play("playerDeath");

    expect(engine.scheduleTone).toHaveBeenCalledTimes(3);

    const firstTone = getScheduledToneCall(engine, 0);
    const secondTone = getScheduledToneCall(engine, 1);
    const thirdTone = getScheduledToneCall(engine, 2);

    expect(firstTone.frequency).toBe(220);
    expect(firstTone.duration).toBe(0.16);
    expect(firstTone.gain).toBe(0.08);
    expect(firstTone.type).toBe("sawtooth");
    expect(firstTone.tag).toBe("playerDeath");
    expect(firstTone.cooldownSeconds).toBe(SFX_COOLDOWN_SECONDS);
    expect(firstTone.startOffset).toBeUndefined();

    expect(secondTone.frequency).toBe(160);
    expect(secondTone.duration).toBe(0.2);
    expect(secondTone.gain).toBe(0.07);
    expect(secondTone.type).toBe("square");
    expect(secondTone.startOffset).toBeCloseTo(0.16 * 0.68);
    expect(secondTone.tag).toBeUndefined();
    expect(secondTone.cooldownSeconds).toBeUndefined();

    expect(thirdTone.frequency).toBe(110);
    expect(thirdTone.duration).toBe(0.25);
    expect(thirdTone.gain).toBe(0.05);
    expect(thirdTone.type).toBe("triangle");
    expect(thirdTone.startOffset).toBeCloseTo((0.16 + 0.2) * 0.68);
    expect(thirdTone.tag).toBeUndefined();
    expect(thirdTone.cooldownSeconds).toBeUndefined();
  });

  it("forwards arm, getStatus, and setMuted to the injected engine", async () => {
    const engine = createMockSfxEngine("muted");
    const controller = createSfxController(engine);

    expect(controller.arm).toBe(engine.arm);
    expect(controller.getStatus).toBe(engine.getStatus);
    expect(controller.setMuted).toBe(engine.setMuted);

    await controller.arm();

    expect(engine.arm).toHaveBeenCalledTimes(1);
    expect(controller.getStatus()).toBe("muted");
    expect(engine.getStatus).toHaveBeenCalledTimes(1);

    controller.setMuted(true);

    expect(engine.setMuted).toHaveBeenCalledWith(true);
  });
});

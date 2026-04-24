export type AudioEngineStatus = "idle" | "ready" | "muted";

export type AudioDestinationLike = object;

export type AudioParamLike = {
  setValueAtTime: (value: number, time: number) => unknown;
  exponentialRampToValueAtTime: (value: number, time: number) => unknown;
};

export type AudioGainNodeLike = {
  gain: AudioParamLike;
  connect: (target: AudioDestinationLike) => unknown;
};

export type AudioOscillatorNodeLike = {
  type: OscillatorType;
  frequency: AudioParamLike;
  connect: (target: AudioGainNodeLike) => unknown;
  start: (time: number) => void;
  stop: (time: number) => void;
};

export type AudioContextLike = {
  state: AudioContextState;
  readonly destination: AudioDestinationLike;
  currentTime: number;
  resume: () => Promise<void>;
  createOscillator: () => AudioOscillatorNodeLike;
  createGain: () => AudioGainNodeLike;
};

export type ScheduleToneOptions = {
  frequency: number;
  duration: number;
  gain: number;
  type: OscillatorType;
  cooldownSeconds?: number;
  startOffset?: number;
  tag?: string;
};

export type AudioEngine = {
  arm: () => Promise<void>;
  getStatus: () => AudioEngineStatus;
  now: () => number;
  scheduleTone: (options: ScheduleToneOptions) => void;
  setMuted: (muted: boolean) => void;
};

export type CreateAudioEngineOptions = {
  createContext?: () => AudioContextLike;
};

const ATTACK_SECONDS = 0.02;
const MIN_GAIN = 0.0001;
const STOP_PADDING_SECONDS = 0.02;

export function createAudioEngine(
  options: CreateAudioEngineOptions = {}
): AudioEngine {
  const createContext = options.createContext ?? createDefaultAudioContext;
  const lastScheduledAtByTag = new Map<string, number>();
  let context: AudioContextLike | null = null;
  let status: AudioEngineStatus = "idle";
  let muted = false;

  const getOrCreateContext = (): AudioContextLike => {
    if (context === null) {
      context = createContext();
      lastScheduledAtByTag.clear();
    }

    return context;
  };

  return {
    arm: async () => {
      if (status === "muted") {
        return;
      }

      try {
        const audioContext = getOrCreateContext();

        if (audioContext.state === "suspended") {
          await audioContext.resume();
        }

        status = "ready";
      } catch {
        status = "muted";
      }
    },
    getStatus: () => (muted ? "muted" : status),
    now: () => context?.currentTime ?? 0,
    scheduleTone: ({
      frequency,
      duration,
      gain,
      type,
      cooldownSeconds,
      startOffset = 0,
      tag
    }) => {
      if (muted || status !== "ready" || context === null) {
        return;
      }

      const currentTime = context.currentTime;

      if (tag !== undefined && cooldownSeconds !== undefined) {
        const lastScheduledAt = lastScheduledAtByTag.get(tag);

        if (
          lastScheduledAt !== undefined &&
          currentTime - lastScheduledAt < cooldownSeconds
        ) {
          return;
        }

        lastScheduledAtByTag.set(tag, currentTime);
      }

      const startTime = currentTime + startOffset;
      const endTime = startTime + duration;
      const oscillator = context.createOscillator();
      const toneGain = context.createGain();

      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, startTime);
      toneGain.gain.setValueAtTime(MIN_GAIN, startTime);
      toneGain.gain.exponentialRampToValueAtTime(
        gain,
        startTime + ATTACK_SECONDS
      );
      toneGain.gain.exponentialRampToValueAtTime(MIN_GAIN, endTime);

      oscillator.connect(toneGain);
      toneGain.connect(context.destination);
      oscillator.start(startTime);
      oscillator.stop(endTime + STOP_PADDING_SECONDS);
    },
    setMuted: (value) => {
      muted = value;
    }
  };
}

function createDefaultAudioContext(): AudioContextLike {
  return new AudioContext() as unknown as AudioContextLike;
}

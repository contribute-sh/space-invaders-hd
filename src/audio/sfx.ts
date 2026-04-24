import { createAudioEngine, type AudioEngine } from "./engine";

export type SfxName = "shoot" | "hit" | "playerDeath" | "waveClear";
export type AudioStatus = "idle" | "ready" | "muted" | "unavailable";

export type SfxController = {
  arm: () => Promise<void>;
  getStatus: () => AudioStatus;
  play: (name: SfxName) => void;
  setMuted: (muted: boolean) => void;
};

type Tone = {
  frequency: number;
  duration: number;
  gain: number;
  type: OscillatorType;
};

const SFX_COOLDOWN_SECONDS = 0.03;
const SFX_TONE_OFFSET_SCALE = 0.68;

const SFX_TONE_PATTERNS: Record<SfxName, readonly Tone[]> = {
  shoot: [
    { frequency: 720, duration: 0.09, gain: 0.06, type: "square" },
    { frequency: 940, duration: 0.06, gain: 0.04, type: "triangle" }
  ],
  hit: [
    { frequency: 320, duration: 0.05, gain: 0.08, type: "square" },
    { frequency: 250, duration: 0.08, gain: 0.05, type: "sawtooth" }
  ],
  playerDeath: [
    { frequency: 220, duration: 0.16, gain: 0.08, type: "sawtooth" },
    { frequency: 160, duration: 0.2, gain: 0.07, type: "square" },
    { frequency: 110, duration: 0.25, gain: 0.05, type: "triangle" }
  ],
  waveClear: [
    { frequency: 520, duration: 0.1, gain: 0.05, type: "triangle" },
    { frequency: 660, duration: 0.1, gain: 0.05, type: "triangle" },
    { frequency: 840, duration: 0.16, gain: 0.06, type: "triangle" }
  ]
};

export function createSfxController(
  engine: AudioEngine = createAudioEngine()
): SfxController {
  const lastPlayedAtByName = new Map<SfxName, number>();

  return {
    arm: engine.arm,
    getStatus: engine.getStatus,
    play: (name) => {
      if (engine.getStatus() !== "ready") {
        return;
      }

      const now = engine.now();
      const lastPlayedAt = lastPlayedAtByName.get(name);

      if (
        lastPlayedAt !== undefined &&
        now - lastPlayedAt < SFX_COOLDOWN_SECONDS
      ) {
        return;
      }

      lastPlayedAtByName.set(name, now);

      let startOffset = 0;
      let isFirstTone = true;

      for (const tone of getTonePattern(name)) {
        engine.scheduleTone({
          ...tone,
          startOffset,
          tag: name,
          ...(isFirstTone
            ? { cooldownSeconds: SFX_COOLDOWN_SECONDS }
            : {})
        });
        startOffset += tone.duration * SFX_TONE_OFFSET_SCALE;
        isFirstTone = false;
      }
    },
    setMuted: engine.setMuted
  };
}

function getTonePattern(name: SfxName): readonly Tone[] {
  return SFX_TONE_PATTERNS[name];
}

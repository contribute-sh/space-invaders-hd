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

type SfxAudioEngine = Pick<
  AudioEngine,
  "arm" | "getStatus" | "scheduleTone" | "setMuted"
>;

const SFX_COOLDOWN_SECONDS = 0.03;
const TONE_START_OFFSET_MULTIPLIER = 0.68;

export function createSfxController(
  engine: SfxAudioEngine = createAudioEngine()
): SfxController {
  return {
    arm: engine.arm,
    getStatus: engine.getStatus,
    play: (name) => {
      if (engine.getStatus() !== "ready") {
        return;
      }

      let startOffset = 0;

      for (const [index, tone] of getTonePattern(name).entries()) {
        engine.scheduleTone({
          ...tone,
          cooldownSeconds:
            index === 0 ? SFX_COOLDOWN_SECONDS : undefined,
          startOffset,
          tag: name
        });
        startOffset += tone.duration * TONE_START_OFFSET_MULTIPLIER;
      }
    },
    setMuted: engine.setMuted
  };
}

function getTonePattern(name: SfxName): Tone[] {
  switch (name) {
    case "shoot":
      return [
        { frequency: 720, duration: 0.09, gain: 0.06, type: "square" },
        { frequency: 940, duration: 0.06, gain: 0.04, type: "triangle" }
      ];
    case "hit":
      return [
        { frequency: 320, duration: 0.05, gain: 0.08, type: "square" },
        { frequency: 250, duration: 0.08, gain: 0.05, type: "sawtooth" }
      ];
    case "playerDeath":
      return [
        { frequency: 220, duration: 0.16, gain: 0.08, type: "sawtooth" },
        { frequency: 160, duration: 0.2, gain: 0.07, type: "square" },
        { frequency: 110, duration: 0.25, gain: 0.05, type: "triangle" }
      ];
    case "waveClear":
      return [
        { frequency: 520, duration: 0.1, gain: 0.05, type: "triangle" },
        { frequency: 660, duration: 0.1, gain: 0.05, type: "triangle" },
        { frequency: 840, duration: 0.16, gain: 0.06, type: "triangle" }
      ];
  }
}

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

export function createSfxController(): SfxController {
  let context: AudioContext | null = null;
  let status: Exclude<AudioStatus, "muted"> = "idle";
  let muted = false;
  const lastPlayedAtByName = new Map<SfxName, number>();

  const getStatus = (): AudioStatus => {
    if (status === "unavailable") {
      return "unavailable";
    }

    if (muted) {
      return "muted";
    }

    return status;
  };

  return {
    arm: async () => {
      try {
        if (context === null) {
          context = new AudioContext();
          lastPlayedAtByName.clear();
        }
        if (context.state === "suspended") {
          await context.resume();
        }
        status = "ready";
      } catch {
        context = null;
        status = "unavailable";
      }
    },
    getStatus,
    play: (name) => {
      const currentStatus = getStatus();

      if (
        currentStatus === "muted" ||
        currentStatus === "unavailable" ||
        status !== "ready" ||
        context === null
      ) {
        return;
      }

      const now = context.currentTime;
      const lastPlayedAt = lastPlayedAtByName.get(name);

      if (
        lastPlayedAt !== undefined &&
        now - lastPlayedAt < SFX_COOLDOWN_SECONDS
      ) {
        return;
      }

      lastPlayedAtByName.set(name, now);
      const tones = getTonePattern(name);
      let offset = 0;

      for (const tone of tones) {
        playTone(context, now + offset, tone);
        offset += tone.duration * 0.68;
      }
    },
    setMuted: (value) => {
      muted = value;
    }
  };
}

function playTone(
  context: AudioContext,
  startTime: number,
  tone: Tone
): void {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const endTime = startTime + tone.duration;

  oscillator.type = tone.type;
  oscillator.frequency.setValueAtTime(tone.frequency, startTime);
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(tone.gain, startTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, endTime);

  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(startTime);
  oscillator.stop(endTime + 0.02);
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

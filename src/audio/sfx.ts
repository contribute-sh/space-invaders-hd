export type SfxName = "shoot" | "hit" | "playerDeath" | "waveClear";

export type SfxController = {
  arm: () => Promise<void>;
  getStatus: () => "idle" | "ready" | "muted";
  play: (name: SfxName) => void;
  setMuted: (muted: boolean) => void;
};

type Tone = {
  frequency: number;
  duration: number;
  gain: number;
  type: OscillatorType;
};

export function createSfxController(): SfxController {
  let context: AudioContext | null = null;
  let status: "idle" | "ready" | "muted" = "idle";
  let muted = false;

  return {
    arm: async () => {
      if (status === "muted") {
        return;
      }

      try {
        context ??= new AudioContext();
        if (context.state === "suspended") {
          await context.resume();
        }
        status = "ready";
      } catch {
        status = "muted";
      }
    },
    getStatus: () => (muted ? "muted" : status),
    play: (name) => {
      if (muted || status !== "ready" || context === null) {
        return;
      }

      const tones = getTonePattern(name);
      let offset = 0;
      const now = context.currentTime;

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

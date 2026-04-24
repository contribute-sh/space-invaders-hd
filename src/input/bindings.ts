export type ControlAction =
  | "moveLeft"
  | "moveRight"
  | "fire"
  | "pause"
  | "mute"
  | "restart";

type ControlBinding = {
  readonly code: string;
  readonly label: string;
};

export const CONTROL_BINDINGS = {
  moveLeft: {
    code: "ArrowLeft",
    label: "Left Arrow"
  },
  moveRight: {
    code: "ArrowRight",
    label: "Right Arrow"
  },
  fire: {
    code: "Space",
    label: "Space"
  },
  pause: {
    code: "KeyP",
    label: "P"
  },
  mute: {
    code: "KeyM",
    label: "M"
  },
  restart: {
    code: "Enter",
    label: "Enter"
  }
} as const satisfies Record<ControlAction, ControlBinding>;

export type OverlayPrompt =
  | "start"
  | "pause"
  | "waveClear"
  | "gameOver";

export const OVERLAY_PROMPTS = {
  start: "Press Space to Start",
  pause: "Press P to Resume",
  waveClear: "Press Space to Continue",
  gameOver: "Press Enter to Restart"
} as const satisfies Record<OverlayPrompt, string>;

export const CONTROL_FOOTER =
  "Controls: Left Arrow / Right Arrow move  |  Space fires  |  P pauses  |  M mutes  |  Enter restarts";

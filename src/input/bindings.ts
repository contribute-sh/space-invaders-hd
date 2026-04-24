type ControlAction =
  | "moveLeft"
  | "moveRight"
  | "fire"
  | "pause"
  | "mute"
  | "restart";

type OverlayPrompt = "start" | "pause" | "waveClear" | "gameOver";

type ControlBinding = {
  code: string;
  label: string;
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

export const OVERLAY_PROMPTS = {
  start: `Press ${CONTROL_BINDINGS.fire.label} to Start`,
  pause: `Press ${CONTROL_BINDINGS.pause.label} to Resume`,
  waveClear: `Press ${CONTROL_BINDINGS.fire.label} to Continue`,
  gameOver: `Press ${CONTROL_BINDINGS.restart.label} to Restart`
} as const satisfies Record<OverlayPrompt, string>;

export const CONTROL_FOOTER =
  `Controls: Arrow keys move  |  ${CONTROL_BINDINGS.fire.label} fires  |  ` +
  `${CONTROL_BINDINGS.pause.label} pauses  |  ${CONTROL_BINDINGS.mute.label} mutes  |  ` +
  `${CONTROL_BINDINGS.restart.label} restarts`;

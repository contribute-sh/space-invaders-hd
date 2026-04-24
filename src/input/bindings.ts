export type ControlAction =
  | "moveLeft"
  | "moveRight"
  | "fire"
  | "pause"
  | "mute"
  | "restart";

type ControlBinding = Readonly<{
  code: string;
  label: string;
}>;

export const CONTROL_BINDINGS = {
  moveLeft: { code: "ArrowLeft", label: "Left" },
  moveRight: { code: "ArrowRight", label: "Right" },
  fire: { code: "Space", label: "Space" },
  pause: { code: "KeyP", label: "P" },
  mute: { code: "KeyM", label: "M" },
  restart: { code: "Enter", label: "Enter" }
} as const satisfies Record<ControlAction, ControlBinding>;

export type OverlayPrompt = "start" | "pause" | "waveClear" | "gameOver";

export const OVERLAY_PROMPTS = {
  start: `Press ${CONTROL_BINDINGS.fire.label} to Start`,
  pause: `Press ${CONTROL_BINDINGS.pause.label} to Resume`,
  waveClear: `Press ${CONTROL_BINDINGS.fire.label} to Continue`,
  gameOver: `Press ${CONTROL_BINDINGS.restart.label} to Restart`
} as const satisfies Record<OverlayPrompt, string>;

const MOVE_LABEL = `${CONTROL_BINDINGS.moveLeft.label}/${CONTROL_BINDINGS.moveRight.label}` as const;

export const CONTROL_FOOTER =
  `Controls: ${MOVE_LABEL} move  |  ${CONTROL_BINDINGS.fire.label} fires  |  ${CONTROL_BINDINGS.pause.label} pauses  |  ${CONTROL_BINDINGS.mute.label} mutes  |  ${CONTROL_BINDINGS.restart.label} restarts` as const;

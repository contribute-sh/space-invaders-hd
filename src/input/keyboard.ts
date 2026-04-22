import type { Input } from "../game/state";

type KeyboardController = {
  dispose: () => void;
  snapshot: () => Input;
};

export function createKeyboardController(target: Window = window): KeyboardController {
  const held = {
    left: false,
    right: false,
    fire: false,
    pause: false,
    mute: false,
    fireEdge: false,
    pauseEdge: false,
    muteEdge: false
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    switch (event.code) {
      case "ArrowLeft":
        held.left = true;
        event.preventDefault();
        break;
      case "ArrowRight":
        held.right = true;
        event.preventDefault();
        break;
      case "Space":
        if (!held.fire) {
          held.fireEdge = true;
        }
        held.fire = true;
        event.preventDefault();
        break;
      case "KeyP":
        if (!held.pause) {
          held.pauseEdge = true;
        }
        held.pause = true;
        event.preventDefault();
        break;
      case "KeyM":
        if (!held.mute) {
          held.muteEdge = true;
        }
        held.mute = true;
        event.preventDefault();
        break;
      default:
        break;
    }
  };

  const onKeyUp = (event: KeyboardEvent): void => {
    switch (event.code) {
      case "ArrowLeft":
        held.left = false;
        event.preventDefault();
        break;
      case "ArrowRight":
        held.right = false;
        event.preventDefault();
        break;
      case "Space":
        held.fire = false;
        event.preventDefault();
        break;
      case "KeyP":
        held.pause = false;
        event.preventDefault();
        break;
      case "KeyM":
        held.mute = false;
        event.preventDefault();
        break;
      default:
        break;
    }
  };

  target.addEventListener("keydown", onKeyDown);
  target.addEventListener("keyup", onKeyUp);

  return {
    dispose: () => {
      target.removeEventListener("keydown", onKeyDown);
      target.removeEventListener("keyup", onKeyUp);
    },
    snapshot: () => {
      const moveX = held.left === held.right ? 0 : held.left ? -1 : 1;
      const snapshot: Input = {
        moveX,
        firePressed: held.fireEdge,
        pausePressed: held.pauseEdge,
        fireHeld: held.fire,
        pauseHeld: held.pause,
        mutePressed: held.muteEdge
      };

      held.fireEdge = false;
      held.pauseEdge = false;
      held.muteEdge = false;

      return snapshot;
    }
  };
}

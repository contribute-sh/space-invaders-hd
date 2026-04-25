import { describe, expect, it } from "vitest";

import { createKeyboardController } from "./keyboard";

if (typeof globalThis.KeyboardEvent === "undefined") {
  Object.defineProperty(globalThis, "KeyboardEvent", {
    configurable: true,
    writable: true,
    value: class KeyboardEventShim extends Event {
      readonly code: string;

      constructor(type: string, init: KeyboardEventInit = {}) {
        super(type, init);
        this.code = init.code ?? "";
      }
    }
  });
}

type WindowTarget = Pick<
  Window,
  "addEventListener" | "removeEventListener" | "dispatchEvent"
>;

class FakeWindow extends EventTarget implements WindowTarget {}

function createTarget(): Window {
  const target: WindowTarget = new FakeWindow();
  return target as Window;
}

function dispatchKeyDown(target: Window, code: string): KeyboardEvent {
  const event = new KeyboardEvent("keydown", { code, cancelable: true });
  target.dispatchEvent(event);
  return event;
}

function dispatchKeyUp(target: Window, code: string): KeyboardEvent {
  const event = new KeyboardEvent("keyup", { code, cancelable: true });
  target.dispatchEvent(event);
  return event;
}

function dispatchBlur(target: Window): void {
  target.dispatchEvent(new Event("blur"));
}

describe("createKeyboardController", () => {
  const repeatGuardCases = [
    {
      code: "Space",
      edgeField: "firePressed",
      heldField: "fireHeld",
      label: "fire"
    },
    {
      code: "KeyP",
      edgeField: "pausePressed",
      heldField: "pauseHeld",
      label: "pause"
    },
    {
      code: "KeyM",
      edgeField: "mutePressed",
      heldField: undefined,
      label: "mute"
    }
  ] as const;

  it("clears held ArrowLeft input on blur", () => {
    const target = createTarget();
    const controller = createKeyboardController(target);

    dispatchKeyDown(target, "ArrowLeft");
    dispatchBlur(target);

    expect(controller.snapshot().moveX).toBe(0);
  });

  it("cancels symmetric left and right input until one side is released", () => {
    const target = createTarget();
    const controller = createKeyboardController(target);

    dispatchKeyDown(target, "ArrowLeft");
    dispatchKeyDown(target, "ArrowRight");

    expect(controller.snapshot().moveX).toBe(0);

    dispatchKeyUp(target, "ArrowLeft");

    expect(controller.snapshot().moveX).toBe(1);

    dispatchKeyDown(target, "ArrowLeft");
    dispatchKeyUp(target, "ArrowRight");

    expect(controller.snapshot().moveX).toBe(-1);
  });

  it("preserves pending fire, pause, and mute edges across movement keyup events", () => {
    const target = createTarget();
    const controller = createKeyboardController(target);

    dispatchKeyDown(target, "Space");
    dispatchKeyDown(target, "KeyP");
    dispatchKeyDown(target, "KeyM");
    dispatchKeyUp(target, "ArrowLeft");
    dispatchKeyUp(target, "ArrowRight");

    const snapshot = controller.snapshot();

    expect(snapshot.moveX).toBe(0);
    expect(snapshot.firePressed).toBe(true);
    expect(snapshot.pausePressed).toBe(true);
    expect(snapshot.mutePressed).toBe(true);

    controller.dispose();
  });

  it("clears held ArrowRight, Space, and KeyP input and resets mute gating on blur", () => {
    const target = createTarget();
    const controller = createKeyboardController(target);

    dispatchKeyDown(target, "ArrowRight");
    dispatchBlur(target);
    expect(controller.snapshot().moveX).toBe(0);

    dispatchKeyDown(target, "Space");
    dispatchBlur(target);
    expect(controller.snapshot().fireHeld).toBe(false);

    dispatchKeyDown(target, "KeyP");
    dispatchBlur(target);
    expect(controller.snapshot().pauseHeld).toBe(false);

    dispatchKeyDown(target, "KeyM");
    expect(controller.snapshot().mutePressed).toBe(true);
    dispatchBlur(target);
    dispatchKeyDown(target, "KeyM");
    expect(controller.snapshot().mutePressed).toBe(true);
  });

  it("does not synthesize a firePressed edge on blur", () => {
    const target = createTarget();
    const controller = createKeyboardController(target);

    dispatchKeyDown(target, "Space");
    expect(controller.snapshot().firePressed).toBe(true);

    dispatchBlur(target);

    const snapshot = controller.snapshot();

    expect(snapshot.firePressed).toBe(false);
    expect(snapshot.fireHeld).toBe(false);
  });

  it("clears an unconsumed fire edge on blur before snapshot", () => {
    const target = createTarget();
    const controller = createKeyboardController(target);

    dispatchKeyDown(target, "Space");
    dispatchBlur(target);

    const snapshot = controller.snapshot();

    expect(snapshot.firePressed).toBe(false);
    expect(snapshot.fireHeld).toBe(false);
  });

  it("clears an unconsumed pause edge on blur before snapshot", () => {
    const target = createTarget();
    const controller = createKeyboardController(target);

    dispatchKeyDown(target, "KeyP");
    dispatchBlur(target);

    const snapshot = controller.snapshot();

    expect(snapshot.pausePressed).toBe(false);
    expect(snapshot.pauseHeld).toBe(false);
  });

  it("clears an unconsumed mute edge on blur before snapshot", () => {
    const target = createTarget();
    const controller = createKeyboardController(target);

    dispatchKeyDown(target, "KeyM");
    dispatchBlur(target);

    expect(controller.snapshot().mutePressed).toBe(false);
  });

  it("preserves fire edge tracking after blur", () => {
    const target = createTarget();
    const controller = createKeyboardController(target);

    dispatchKeyDown(target, "Space");
    expect(controller.snapshot().firePressed).toBe(true);

    dispatchBlur(target);
    expect(controller.snapshot().firePressed).toBe(false);

    dispatchKeyDown(target, "Space");

    const snapshot = controller.snapshot();

    expect(snapshot.firePressed).toBe(true);
    expect(snapshot.fireHeld).toBe(true);
  });

  for (const { code, edgeField, heldField, label } of repeatGuardCases) {
    it(`does not re-emit the ${label} edge on auto-repeat keydown and re-arms after keyup`, () => {
      const target = createTarget();
      const controller = createKeyboardController(target);

      dispatchKeyDown(target, code);

      const firstSnapshot = controller.snapshot();

      dispatchKeyDown(target, code);

      const secondSnapshot = controller.snapshot();

      dispatchKeyUp(target, code);
      dispatchKeyDown(target, code);

      const rearmedSnapshot = controller.snapshot();

      expect(firstSnapshot[edgeField]).toBe(true);
      expect(secondSnapshot[edgeField]).toBe(false);
      expect(rearmedSnapshot[edgeField]).toBe(true);

      if (heldField !== undefined) {
        expect(firstSnapshot[heldField]).toBe(true);
        expect(secondSnapshot[heldField]).toBe(true);
        expect(rearmedSnapshot[heldField]).toBe(true);
      }
    });
  }

  it("consumes returned fire, pause, and mute edges on the next snapshot", () => {
    const heldEdgeCases = [
      {
        code: "Space",
        edgeField: "firePressed",
        heldField: "fireHeld"
      },
      {
        code: "KeyP",
        edgeField: "pausePressed",
        heldField: "pauseHeld"
      }
    ] as const;

    for (const { code, edgeField, heldField } of heldEdgeCases) {
      const target = createTarget();
      const controller = createKeyboardController(target);

      dispatchKeyDown(target, code);

      const firstSnapshot = controller.snapshot();
      const secondSnapshot = controller.snapshot();

      expect(firstSnapshot[edgeField]).toBe(true);
      expect(firstSnapshot[heldField]).toBe(true);
      expect(secondSnapshot[edgeField]).toBe(false);
      expect(secondSnapshot[heldField]).toBe(true);
    }

    const muteTarget = createTarget();
    const muteController = createKeyboardController(muteTarget);

    dispatchKeyDown(muteTarget, "KeyM");

    const firstMuteSnapshot = muteController.snapshot();
    const secondMuteSnapshot = muteController.snapshot();

    expect(firstMuteSnapshot.mutePressed).toBe(true);
    expect(secondMuteSnapshot.mutePressed).toBe(false);
  });

  describe("preventDefault behavior", () => {
    const recognizedCodes = [
      "ArrowLeft",
      "ArrowRight",
      "Space",
      "KeyP",
      "KeyM"
    ] as const;

    for (const code of recognizedCodes) {
      it(`prevents default for ${code} on keydown and keyup`, () => {
        const target = createTarget();
        const controller = createKeyboardController(target);

        try {
          const keyDownEvent = dispatchKeyDown(target, code);
          const keyUpEvent = dispatchKeyUp(target, code);

          expect(keyDownEvent.defaultPrevented).toBe(true);
          expect(keyUpEvent.defaultPrevented).toBe(true);
        } finally {
          controller.dispose();
        }
      });
    }

    it("does not prevent default for unrecognized keys on keydown and keyup", () => {
      const target = createTarget();
      const controller = createKeyboardController(target);

      try {
        const keyDownEvent = dispatchKeyDown(target, "Tab");
        const keyUpEvent = dispatchKeyUp(target, "Tab");

        expect(keyDownEvent.defaultPrevented).toBe(false);
        expect(keyUpEvent.defaultPrevented).toBe(false);
      } finally {
        controller.dispose();
      }
    });
  });

  it("removes the keydown and keyup listeners on dispose", () => {
    const target = createTarget();
    const controller = createKeyboardController(target);

    controller.dispose();

    const leftKeyDownEvent = dispatchKeyDown(target, "ArrowLeft");
    const leftKeyUpEvent = dispatchKeyUp(target, "ArrowLeft");
    const fireKeyDownEvent = dispatchKeyDown(target, "Space");
    const fireKeyUpEvent = dispatchKeyUp(target, "Space");

    expect(leftKeyDownEvent.defaultPrevented).toBe(false);
    expect(leftKeyUpEvent.defaultPrevented).toBe(false);
    expect(fireKeyDownEvent.defaultPrevented).toBe(false);
    expect(fireKeyUpEvent.defaultPrevented).toBe(false);
    expect(controller.snapshot()).toEqual({
      moveX: 0,
      firePressed: false,
      pausePressed: false,
      fireHeld: false,
      pauseHeld: false,
      mutePressed: false
    });
  });

  it("removes the blur listener on dispose", () => {
    const target = createTarget();
    const controller = createKeyboardController(target);

    dispatchKeyDown(target, "ArrowLeft");
    controller.dispose();
    dispatchBlur(target);

    expect(controller.snapshot().moveX).toBe(-1);
  });
});

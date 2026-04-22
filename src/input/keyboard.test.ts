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

function dispatchKeyDown(target: Window, code: string): void {
  target.dispatchEvent(new KeyboardEvent("keydown", { code }));
}

function dispatchBlur(target: Window): void {
  target.dispatchEvent(new Event("blur"));
}

describe("createKeyboardController", () => {
  it("clears held ArrowLeft input on blur", () => {
    const target = createTarget();
    const controller = createKeyboardController(target);

    dispatchKeyDown(target, "ArrowLeft");
    dispatchBlur(target);

    expect(controller.snapshot().moveX).toBe(0);
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

  it("removes the blur listener on dispose", () => {
    const target = createTarget();
    const controller = createKeyboardController(target);

    dispatchKeyDown(target, "ArrowLeft");
    controller.dispose();
    dispatchBlur(target);

    expect(controller.snapshot().moveX).toBe(-1);
  });
});

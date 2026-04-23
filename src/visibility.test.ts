import { describe, expect, it, vi } from "vitest";

import { createVisibilityPauseController } from "./visibility";

type Listener = EventListenerOrEventListenerObject;

class FakeVisibilityTarget {
  private readonly listeners = new Map<string, Set<Listener>>();

  readonly addedTypes: string[] = [];
  readonly removedTypes: string[] = [];

  addEventListener(type: string, listener: Listener | null): void {
    this.addedTypes.push(type);

    if (listener === null) {
      return;
    }

    const listeners = this.listeners.get(type) ?? new Set<Listener>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: Listener | null): void {
    this.removedTypes.push(type);

    if (listener === null) {
      return;
    }

    this.listeners.get(type)?.delete(listener);
  }

  dispatch(type: string): void {
    const event = new Event(type);

    for (const listener of this.listeners.get(type) ?? []) {
      if (typeof listener === "function") {
        listener(event);
        continue;
      }

      listener.handleEvent(event);
    }
  }

  listenerCount(type: string): number {
    return this.listeners.get(type)?.size ?? 0;
  }
}

function createTarget(): FakeVisibilityTarget {
  return new FakeVisibilityTarget();
}

describe("createVisibilityPauseController", () => {
  it("fires onHide when the visibilitychange event reports hidden", () => {
    const target = createTarget();
    const onHide = vi.fn();

    createVisibilityPauseController({
      target: target as Pick<Document, "addEventListener" | "removeEventListener">,
      isHidden: () => true,
      onHide
    });

    target.dispatch("visibilitychange");

    expect(onHide).toHaveBeenCalledTimes(1);
  });

  it("does not fire onHide when the visibilitychange event reports visible", () => {
    const target = createTarget();
    const onHide = vi.fn();

    createVisibilityPauseController({
      target: target as Pick<Document, "addEventListener" | "removeEventListener">,
      isHidden: () => false,
      onHide
    });

    target.dispatch("visibilitychange");

    expect(onHide).not.toHaveBeenCalled();
  });

  it("detaches the listener on dispose", () => {
    const target = createTarget();
    const onHide = vi.fn();
    const controller = createVisibilityPauseController({
      target: target as Pick<Document, "addEventListener" | "removeEventListener">,
      isHidden: () => true,
      onHide
    });

    controller.dispose();
    target.dispatch("visibilitychange");

    expect(onHide).not.toHaveBeenCalled();
    expect(target.removedTypes).toEqual(["visibilitychange"]);
  });

  it("adds exactly one visibilitychange listener", () => {
    const target = createTarget();

    createVisibilityPauseController({
      target: target as Pick<Document, "addEventListener" | "removeEventListener">,
      isHidden: () => true,
      onHide: () => {}
    });

    expect(target.addedTypes).toEqual(["visibilitychange"]);
    expect(target.listenerCount("visibilitychange")).toBe(1);
  });
});

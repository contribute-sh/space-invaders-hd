import { describe, expect, it } from "vitest";

import { createMuteStore } from "./mute";

const MUTE_STORAGE_KEY = "audio:muted";

class FakeStorage implements Storage {
  private readonly entries = new Map<string, string>();

  public throwOnGet = false;
  public throwOnSet = false;

  get length(): number {
    return this.entries.size;
  }

  clear(): void {
    this.entries.clear();
  }

  getItem(key: string): string | null {
    if (this.throwOnGet) {
      throw new Error("getItem failed");
    }

    return this.entries.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.entries.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.entries.delete(key);
  }

  setItem(key: string, value: string): void {
    if (this.throwOnSet) {
      throw new Error("setItem failed");
    }

    this.entries.set(key, value);
  }

  seed(key: string, value: string): void {
    this.entries.set(key, value);
  }
}

describe("createMuteStore", () => {
  it("defaults to false when storage is empty", () => {
    const store = createMuteStore(new FakeStorage());

    expect(store.isMuted()).toBe(false);
  });

  it("toggles the muted state and returns the new value", () => {
    const storage = new FakeStorage();
    const store = createMuteStore(storage);

    expect(store.toggle()).toBe(true);
    expect(store.isMuted()).toBe(true);
    expect(storage.getItem(MUTE_STORAGE_KEY)).toBe("true");

    expect(store.toggle()).toBe(false);
    expect(store.isMuted()).toBe(false);
    expect(storage.getItem(MUTE_STORAGE_KEY)).toBe("false");
  });

  it("round-trips the stored muted state", () => {
    const storage = new FakeStorage();
    const firstStore = createMuteStore(storage);

    expect(firstStore.toggle()).toBe(true);

    const secondStore = createMuteStore(storage);

    expect(secondStore.isMuted()).toBe(true);
  });

  it.each(["TRUE", "1", "yes", ""])(
    "falls back to false for invalid stored value %s",
    (storedValue) => {
      const storage = new FakeStorage();
      storage.seed(MUTE_STORAGE_KEY, storedValue);
      const store = createMuteStore(storage);

      expect(store.isMuted()).toBe(false);
    }
  );

  it("falls back to in-memory state when getItem and setItem throw", () => {
    const storage = new FakeStorage();
    storage.throwOnGet = true;
    storage.throwOnSet = true;
    let store!: ReturnType<typeof createMuteStore>;
    let nextMuted = false;

    expect(() => {
      store = createMuteStore(storage);
    }).not.toThrow();

    expect(store.isMuted()).toBe(false);
    expect(() => {
      nextMuted = store.toggle();
    }).not.toThrow();
    expect(nextMuted).toBe(true);
    expect(store.isMuted()).toBe(true);
    expect(store.toggle()).toBe(false);
  });

  it("keeps the seeded muted value in memory when only setItem throws", () => {
    const storage = new FakeStorage();
    storage.seed(MUTE_STORAGE_KEY, "true");
    storage.throwOnSet = true;
    const store = createMuteStore(storage);
    let nextMuted = true;

    expect(store.isMuted()).toBe(true);
    expect(() => {
      nextMuted = store.toggle();
    }).not.toThrow();
    expect(nextMuted).toBe(false);
    expect(store.isMuted()).toBe(false);
  });

  it("notifies subscribers on toggle and stops after unsubscribe", () => {
    const storage = new FakeStorage();
    const store = createMuteStore(storage);
    const notifications: Array<{ muted: boolean; storedValue: string | null }> =
      [];
    const unsubscribe = store.subscribe(() => {
      notifications.push({
        muted: store.isMuted(),
        storedValue: storage.getItem(MUTE_STORAGE_KEY)
      });
    });

    expect(store.toggle()).toBe(true);
    expect(notifications).toEqual([
      { muted: true, storedValue: "true" }
    ]);

    unsubscribe();

    expect(store.toggle()).toBe(false);
    expect(notifications).toEqual([
      { muted: true, storedValue: "true" }
    ]);
  });
});

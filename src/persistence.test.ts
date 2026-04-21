import { describe, expect, it } from "vitest";

import { createHighScoreStore } from "./persistence";

const HIGH_SCORE_STORAGE_KEY = "space-invaders-hd.highScore";

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

describe("createHighScoreStore", () => {
  it("returns 0 when storage is empty", () => {
    const store = createHighScoreStore(new FakeStorage());

    expect(store.getHighScore()).toBe(0);
  });

  it("round-trips a recorded score through storage", () => {
    const storage = new FakeStorage();
    const firstStore = createHighScoreStore(storage);

    expect(firstStore.recordScore(180)).toBe(180);

    const secondStore = createHighScoreStore(storage);

    expect(secondStore.getHighScore()).toBe(180);
  });

  it("ignores scores below the stored high score", () => {
    const storage = new FakeStorage();
    storage.seed(HIGH_SCORE_STORAGE_KEY, "220");
    const store = createHighScoreStore(storage);

    expect(store.recordScore(100)).toBe(220);
    expect(storage.getItem(HIGH_SCORE_STORAGE_KEY)).toBe("220");
  });

  it("persists scores above the stored high score", () => {
    const storage = new FakeStorage();
    storage.seed(HIGH_SCORE_STORAGE_KEY, "220");
    const store = createHighScoreStore(storage);

    expect(store.recordScore(360)).toBe(360);
    expect(storage.getItem(HIGH_SCORE_STORAGE_KEY)).toBe("360");
  });

  it.each(["not-a-number", "-5", "NaN"])(
    "recovers from malformed stored value %s",
    (storedValue) => {
      const storage = new FakeStorage();
      storage.seed(HIGH_SCORE_STORAGE_KEY, storedValue);
      const store = createHighScoreStore(storage);

      expect(store.getHighScore()).toBe(0);
    }
  );

  it("swallows getItem failures", () => {
    const storage = new FakeStorage();
    storage.throwOnGet = true;
    const store = createHighScoreStore(storage);

    expect(store.getHighScore()).toBe(0);
  });

  it("swallows setItem failures", () => {
    const storage = new FakeStorage();
    storage.throwOnSet = true;
    const store = createHighScoreStore(storage);

    expect(store.recordScore(400)).toBe(400);
    expect(store.getHighScore()).toBe(400);
    expect(storage.key(0)).toBeNull();
  });
});

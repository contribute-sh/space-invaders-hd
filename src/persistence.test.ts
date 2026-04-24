import { describe, expect, it } from "vitest";

import { createHighScoreStore, pickDisplayHighScore } from "./persistence";

const HIGH_SCORE_STORAGE_KEY = "space-invaders-hd.highScore";

class FakeStorage implements Storage {
  private readonly entries = new Map<string, string>();

  public readonly setItemCalls: Array<{ key: string; value: string }> = [];
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

    this.setItemCalls.push({ key, value });
    this.entries.set(key, value);
  }

  seed(key: string, value: string): void {
    this.entries.set(key, value);
  }
}

describe("pickDisplayHighScore", () => {
  it("returns the larger of the stored and current score", () => {
    expect(pickDisplayHighScore(220, 360)).toBe(360);
    expect(pickDisplayHighScore(480, 360)).toBe(480);
  });
});

describe("pickDisplayHighScore edge cases", () => {
  it("keeps a positive stored high score when the current score is negative", () => {
    const result = pickDisplayHighScore(100, -5);

    expect(result).toBe(100);
    expect(Number.isFinite(result)).toBe(true);
    expect(result >= 0).toBe(true);
  });

  it.each([
    { storedHighScore: 100, currentScore: Number.NaN },
    { storedHighScore: Number.NaN, currentScore: 75 }
  ])(
    "returns a finite, non-negative score when one value is NaN",
    ({ storedHighScore, currentScore }) => {
      const result = pickDisplayHighScore(storedHighScore, currentScore);

      expect(Number.isFinite(result)).toBe(true);
      expect(result >= 0).toBe(true);
    }
  );

  it.each([
    { storedHighScore: Number.POSITIVE_INFINITY, currentScore: 50 },
    { storedHighScore: Number.NEGATIVE_INFINITY, currentScore: 50 },
    { storedHighScore: 50, currentScore: Number.POSITIVE_INFINITY },
    { storedHighScore: 50, currentScore: Number.NEGATIVE_INFINITY }
  ])(
    "returns a finite, non-negative score when one value is infinite",
    ({ storedHighScore, currentScore }) => {
      const result = pickDisplayHighScore(storedHighScore, currentScore);

      expect(Number.isFinite(result)).toBe(true);
      expect(result >= 0).toBe(true);
    }
  );

  it("returns the shared value when both scores are equal", () => {
    expect(pickDisplayHighScore(42, 42)).toBe(42);
  });
});

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
    expect(storage.setItemCalls).toHaveLength(0);
  });

  it("does not write when the score does not exceed the stored high score", () => {
    const storage = new FakeStorage();
    storage.seed(HIGH_SCORE_STORAGE_KEY, "500");
    const store = createHighScoreStore(storage);

    storage.setItemCalls.splice(0);

    expect(store.recordScore(499)).toBe(500);
    expect(
      storage.setItemCalls.filter(({ key }) => key === HIGH_SCORE_STORAGE_KEY)
    ).toEqual([]);

    expect(store.recordScore(500)).toBe(500);
    expect(
      storage.setItemCalls.filter(({ key }) => key === HIGH_SCORE_STORAGE_KEY)
    ).toEqual([]);
  });

  it("persists scores above the stored high score", () => {
    const storage = new FakeStorage();
    storage.seed(HIGH_SCORE_STORAGE_KEY, "220");
    const store = createHighScoreStore(storage);

    expect(store.recordScore(360)).toBe(360);
    expect(storage.getItem(HIGH_SCORE_STORAGE_KEY)).toBe("360");
  });

  it("persists each new high score exactly once", () => {
    const storage = new FakeStorage();
    const store = createHighScoreStore(storage);

    expect(store.recordScore(120)).toBe(120);
    expect(store.recordScore(240)).toBe(240);
    expect(store.recordScore(240)).toBe(240);
    expect(store.recordScore(360)).toBe(360);

    expect(storage.setItemCalls).toEqual([
      { key: HIGH_SCORE_STORAGE_KEY, value: "120" },
      { key: HIGH_SCORE_STORAGE_KEY, value: "240" },
      { key: HIGH_SCORE_STORAGE_KEY, value: "360" }
    ]);
    expect(storage.getItem(HIGH_SCORE_STORAGE_KEY)).toBe("360");
  });

  it("surfaces the live high score before any final game-over write", () => {
    const storage = new FakeStorage();
    storage.seed(HIGH_SCORE_STORAGE_KEY, "220");
    const store = createHighScoreStore(storage);

    expect(store.recordScore(260)).toBe(260);
    expect(store.getHighScore()).toBe(260);
    expect(pickDisplayHighScore(store.getHighScore(), 320)).toBe(320);
    expect(storage.getItem(HIGH_SCORE_STORAGE_KEY)).toBe("260");
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

  describe("when storage throws", () => {
    it("returns 0 when reading the stored high score throws", () => {
      const storage = new FakeStorage();
      storage.throwOnGet = true;
      const store = createHighScoreStore(storage);

      expect(store.getHighScore()).toBe(0);
    });

    it("keeps the in-memory high score when writing the stored high score throws", () => {
      const storage = new FakeStorage();
      storage.seed(HIGH_SCORE_STORAGE_KEY, "220");
      storage.throwOnSet = true;
      const store = createHighScoreStore(storage);

      expect(store.recordScore(360)).toBe(360);
      expect(store.getHighScore()).toBe(360);
      expect(storage.getItem(HIGH_SCORE_STORAGE_KEY)).toBe("220");
    });

    it("falls back to memory storage when localStorage access throws", () => {
      const originalLocalStorageDescriptor = Object.getOwnPropertyDescriptor(
        globalThis,
        "localStorage"
      );

      Object.defineProperty(globalThis, "localStorage", {
        configurable: true,
        get() {
          throw new Error("localStorage unavailable");
        }
      });

      try {
        const store = createHighScoreStore();
        const initialHighScore = store.getHighScore();
        const nextHighScore = initialHighScore + 1;

        expect(store.recordScore(nextHighScore)).toBe(nextHighScore);
        expect(store.getHighScore()).toBe(nextHighScore);
      } finally {
        if (originalLocalStorageDescriptor) {
          Object.defineProperty(
            globalThis,
            "localStorage",
            originalLocalStorageDescriptor
          );
        } else {
          Reflect.deleteProperty(globalThis, "localStorage");
        }
      }
    });
  });
});

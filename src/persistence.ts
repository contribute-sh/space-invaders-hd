const HIGH_SCORE_STORAGE_KEY = "space-invaders-hd.highScore";

const fallbackStorage = createMemoryStorage();

export type HighScoreStore = {
  getHighScore: () => number;
  recordScore: (score: number) => number;
};

export function createHighScoreStore(
  storage: Storage = getDefaultStorage()
): HighScoreStore {
  let highScore = readStoredHighScore(storage);

  return {
    getHighScore: () => highScore,
    recordScore: (score) => {
      const nextHighScore = normalizeHighScore(score);

      if (nextHighScore <= highScore) {
        return highScore;
      }

      highScore = nextHighScore;
      writeStoredHighScore(storage, nextHighScore);

      return highScore;
    }
  };
}

function getDefaultStorage(): Storage {
  try {
    const storage = globalThis.localStorage;
    return storage === undefined ? fallbackStorage : storage;
  } catch {
    return fallbackStorage;
  }
}

function readStoredHighScore(storage: Storage): number {
  try {
    return normalizeStoredValue(storage.getItem(HIGH_SCORE_STORAGE_KEY));
  } catch {
    return 0;
  }
}

function writeStoredHighScore(storage: Storage, score: number): void {
  try {
    storage.setItem(HIGH_SCORE_STORAGE_KEY, String(score));
  } catch {
    // Storage failures are non-fatal for gameplay.
  }
}

function normalizeStoredValue(value: string | null): number {
  if (value === null) {
    return 0;
  }

  return normalizeHighScore(Number(value));
}

function normalizeHighScore(score: number): number {
  return Number.isFinite(score) && score >= 0 ? score : 0;
}

function createMemoryStorage(): Storage {
  const entries = new Map<string, string>();

  return {
    get length() {
      return entries.size;
    },
    clear() {
      entries.clear();
    },
    getItem(key) {
      return entries.get(key) ?? null;
    },
    key(index) {
      return [...entries.keys()][index] ?? null;
    },
    removeItem(key) {
      entries.delete(key);
    },
    setItem(key, value) {
      entries.set(key, value);
    }
  };
}

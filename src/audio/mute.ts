const MUTE_STORAGE_KEY = "audio:muted";

const fallbackStorage = createMemoryStorage();

type MuteStoreListener = () => void;

export type MuteStore = {
  isMuted: () => boolean;
  toggle: () => boolean;
  subscribe: (listener: MuteStoreListener) => () => void;
};

export function createMuteStore(
  storage: Storage = getDefaultStorage()
): MuteStore {
  let muted = readStoredMuted(storage);
  const listeners = new Set<MuteStoreListener>();

  return {
    isMuted: () => muted,
    toggle: () => {
      muted = !muted;
      writeStoredMuted(storage, muted);

      for (const listener of listeners) {
        listener();
      }

      return muted;
    },
    subscribe: (listener) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    }
  };
}

function getDefaultStorage(): Storage {
  try {
    if (typeof window === "undefined") {
      return fallbackStorage;
    }

    return window.localStorage;
  } catch {
    return fallbackStorage;
  }
}

function readStoredMuted(storage: Storage): boolean {
  try {
    return parseStoredMuted(storage.getItem(MUTE_STORAGE_KEY));
  } catch {
    return false;
  }
}

function writeStoredMuted(storage: Storage, muted: boolean): void {
  try {
    storage.setItem(MUTE_STORAGE_KEY, String(muted));
  } catch {
    // Storage failures are non-fatal for audio state.
  }
}

function parseStoredMuted(value: string | null): boolean {
  return value === "true";
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

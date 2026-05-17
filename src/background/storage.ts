import type { ConnectionSettings, SessionState } from "../shared/types";

const SETTINGS_KEY = "connectionSettings";
const SESSION_KEY = "downloadStationSession";

type StorageArea = {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(key: string): Promise<void>;
};
export type StorageRoot = {
  local: StorageArea;
  session: StorageArea;
};

export type StorageAdapter = ReturnType<typeof createStorageAdapter>;

export function createStorageAdapter(storage: StorageRoot) {
  return {
    async getSettings(): Promise<ConnectionSettings | null> {
      const result = await storage.local.get(SETTINGS_KEY);
      return (result[SETTINGS_KEY] as ConnectionSettings | undefined) ?? null;
    },

    async saveSettings(settings: ConnectionSettings): Promise<void> {
      await storage.local.set({ [SETTINGS_KEY]: settings });
    },

    async getSession(): Promise<SessionState | null> {
      const result = await storage.session.get(SESSION_KEY);
      return (result[SESSION_KEY] as SessionState | undefined) ?? null;
    },

    async saveSession(session: SessionState): Promise<void> {
      await storage.session.set({ [SESSION_KEY]: session });
    },

    async clearSession(): Promise<void> {
      await storage.session.remove(SESSION_KEY);
    }
  };
}

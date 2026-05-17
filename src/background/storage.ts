import type { ConnectionSettings, Locale, SessionState } from "../shared/types";

const SETTINGS_KEY = "connectionSettings";
const SESSION_KEY = "downloadStationSession";
const LOCALE_KEY = "locale";

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
    },

    async getLocale(): Promise<Locale | null> {
      const result = await storage.local.get(LOCALE_KEY);
      const locale = result[LOCALE_KEY];
      return locale === "en" || locale === "zh" ? locale : null;
    },

    async saveLocale(locale: Locale): Promise<void> {
      await storage.local.set({ [LOCALE_KEY]: locale });
    }
  };
}

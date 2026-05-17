import { AppError, asApiError, isAuthError } from "./errors";
import type { StorageAdapter } from "./storage";
import type { SynologyClient } from "./synologyClient";
import type { DestinationOption, DownloadTask, SessionState } from "../shared/types";

export type SessionManager = ReturnType<typeof createSessionManager>;

export function createSessionManager(deps: {
  storage: StorageAdapter;
  clientFactory: (baseUrl: string) => SynologyClient;
  now?: () => number;
}) {
  async function connect(): Promise<void> {
    const settings = await requireSettings();
    const session = await deps.clientFactory(settings.baseUrl).login(settings.username, settings.password);
    await deps.storage.saveSession({ ...session, createdAt: deps.now?.() ?? session.createdAt });
  }

  async function disconnect(): Promise<void> {
    const settings = await deps.storage.getSettings();
    const session = await deps.storage.getSession();
    if (settings && session) {
      try {
        await deps.clientFactory(settings.baseUrl).logout(session.sid);
      } catch {
        // Local session cleanup matters more than remote logout success.
      }
    }
    await deps.storage.clearSession();
  }

  async function listTasks(): Promise<DownloadTask[]> {
    return withSession((client, session) => client.listTasks(session.sid));
  }

  async function createDownload(uris: string[], destination?: string): Promise<{ created: number }> {
    return withSession((client, session) => client.createDownload(session.sid, uris, destination));
  }

  async function listDestinations(): Promise<DestinationOption[]> {
    return withSession((client, session) => client.listDestinations(session.sid));
  }

  async function withSession<T>(operation: (client: SynologyClient, session: SessionState) => Promise<T>): Promise<T> {
    const settings = await requireSettings();
    const client = deps.clientFactory(settings.baseUrl);
    const session = (await deps.storage.getSession()) ?? (await login(settings, client));

    try {
      return await operation(client, session);
    } catch (error) {
      if (!isAuthError(error)) {
        throw new AppError(asApiError(error));
      }
      await deps.storage.clearSession();
      const nextSession = await login(settings, client);
      return operation(client, nextSession);
    }
  }

  async function login(settings: { username: string; password: string }, client: SynologyClient): Promise<SessionState> {
    const session = await client.login(settings.username, settings.password);
    const saved = { ...session, createdAt: deps.now?.() ?? session.createdAt };
    await deps.storage.saveSession(saved);
    return saved;
  }

  async function requireSettings() {
    const settings = await deps.storage.getSettings();
    if (!settings) {
      throw new AppError({ code: "settings_missing", message: "DSM connection settings are missing.", retryable: false });
    }
    return settings;
  }

  return { connect, disconnect, listTasks, listDestinations, createDownload };
}

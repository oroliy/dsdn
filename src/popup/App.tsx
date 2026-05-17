import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { AddDownload } from "./AddDownload";
import { sendMessage } from "./api";
import { formatBytes, TaskList, translateStatus } from "./TaskList";
import { getMessages, type Locale, type Messages } from "./i18n";
import { isSupportedDownloadUri } from "../shared/downloadUris";
import type { ConnectionSettings, DestinationOption, DownloadTask } from "../shared/types";

type View = "loading" | "setup" | "tasks" | "add";

const emptySettings: ConnectionSettings = {
  baseUrl: "",
  username: "",
  password: ""
};

export function App() {
  const [locale, setLocale] = useState<Locale>("en");
  const t = getMessages(locale);
  const [view, setView] = useState<View>("loading");
  const [settings, setSettings] = useState<ConnectionSettings>(emptySettings);
  const [tasks, setTasks] = useState<DownloadTask[]>([]);
  const [selectedTask, setSelectedTask] = useState<DownloadTask | null>(null);
  const [addInitialUris, setAddInitialUris] = useState<string[]>(() => getInitialAddDownloadUris());
  const [destinations, setDestinations] = useState<DestinationOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createNotice, setCreateNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    let mounted = true;
    void sendMessage({ type: "locale.get" }).then((response) => {
      if (!mounted || !response.ok || !response.data) return;
      setLocale(response.data);
    });
    void sendMessage({ type: "settings.get" }).then((response) => {
      if (!mounted) return;
      if (!response.ok || !response.data) {
        setView("setup");
        return;
      }
      setSettings(response.data);
      if (addInitialUris.length > 0) {
        void openAddView(addInitialUris);
        return;
      }
      setView("tasks");
      void loadTasks();
    });
    return () => {
      mounted = false;
    };
  }, []);

  function changeLocale(nextLocale: Locale) {
    setLocale(nextLocale);
    void sendMessage({ type: "locale.save", locale: nextLocale });
  }

  async function loadTasks(): Promise<DownloadTask[] | null> {
    setLoading(true);
    setError(null);
    const response = await sendMessage({ type: "tasks.list" });
    setLoading(false);
    if (!response.ok) {
      setError(response.error.message);
      if (response.error.code === "auth_failed" || response.error.code === "settings_missing") {
        setView("setup");
      }
      return null;
    }
    setTasks(response.data);
    return response.data;
  }

  async function openAddView(initialUris: string[] = []) {
    setAddInitialUris(initialUris);
    setView("add");
    setError(null);
    setCreateNotice(null);
    const response = await sendMessage({ type: "destinations.list" });
    if (!response.ok) {
      setError(response.error.message);
      setDestinations([]);
      return;
    }
    setDestinations(response.data);
  }

  function closeAddView() {
    setAddInitialUris([]);
    setCreateNotice(null);
    setView("tasks");
    void loadTasks();
  }

  async function saveAndConnect(nextSettings: ConnectionSettings) {
    const urlError = validateSetupUrl(nextSettings.baseUrl, t);
    if (urlError) {
      setError(urlError);
      return;
    }

    setLoading(true);
    setError(null);
    const save = await sendMessage({ type: "settings.save", settings: nextSettings });
    if (!save.ok) {
      setLoading(false);
      setError(save.error.message);
      return;
    }
    const connect = await sendMessage({ type: "session.connect" });
    setLoading(false);
    if (!connect.ok) {
      setError(connect.error.message);
      return;
    }
    setSettings(nextSettings);
    if (addInitialUris.length > 0) {
      await openAddView(addInitialUris);
      return;
    }
    setView("tasks");
    await loadTasks();
  }

  async function createDownload(uris: string[], destination?: string) {
    const shouldCloseAfterStatus = addInitialUris.length > 0;
    setLoading(true);
    setError(null);
    setCreateNotice(null);
    const response = await sendMessage({ type: "downloads.create", uris, destination });
    setLoading(false);
    if (!response.ok) {
      if (shouldCloseAfterStatus) {
        setCreateNotice({ type: "error", message: `${t.createFailed}: ${response.error.message}` });
        await delay(1500);
        window.close();
        return;
      }
      setError(response.error.message);
      return;
    }
    setAddInitialUris([]);
    if (shouldCloseAfterStatus) {
      setCreateNotice({ type: "success", message: t.downloadCreated });
      await delay(1200);
      window.close();
      return;
    }
    setView("tasks");
    await loadTasks();
  }

  async function pauseTask(task: DownloadTask) {
    await controlTask(task, "tasks.pause");
  }

  async function resumeTask(task: DownloadTask) {
    await controlTask(task, "tasks.resume");
  }

  async function deleteTask(task: DownloadTask) {
    setLoading(true);
    setError(null);
    const response = await sendMessage({ type: "tasks.delete", id: task.id });
    setLoading(false);
    if (!response.ok) {
      setError(response.error.message);
      return;
    }
    setSelectedTask(null);
    await loadTasks();
  }

  async function controlTask(task: DownloadTask, type: "tasks.pause" | "tasks.resume") {
    setLoading(true);
    setError(null);
    const response = await sendMessage({ type, id: task.id });
    setLoading(false);
    if (!response.ok) {
      setError(response.error.message);
      return;
    }
    const nextTasks = await loadTasks();
    setSelectedTask(nextTasks?.find((item) => item.id === task.id) ?? null);
  }

  async function controlTaskFromList(task: DownloadTask, action: "pause" | "resume" | "delete") {
    if (action === "pause") {
      await pauseTask(task);
      return;
    }
    if (action === "resume") {
      await resumeTask(task);
      return;
    }
    await deleteTask(task);
  }

  if (view === "loading") {
    return (
      <main className="popup-shell">
        <div className="toolbar">
          <h1>Download Station</h1>
          <LanguageSelect locale={locale} onLocaleChange={changeLocale} t={t} />
        </div>
        <p className="muted">{t.loading}</p>
      </main>
    );
  }

  if (view === "setup") {
    return (
      <main className="popup-shell">
        <SetupForm
          settings={settings}
          loading={loading}
          error={error}
          onSubmit={saveAndConnect}
          languageControl={<LanguageSelect locale={locale} onLocaleChange={changeLocale} t={t} />}
          t={t}
        />
      </main>
    );
  }

  if (view === "add") {
    return (
      <main className="popup-shell">
        <AddDownload
          loading={loading}
          error={error}
          notice={createNotice}
          initialUris={addInitialUris}
          destinations={destinations}
          onCancel={closeAddView}
          onCreate={createDownload}
          languageControl={<LanguageSelect locale={locale} onLocaleChange={changeLocale} t={t} />}
          t={t}
        />
      </main>
    );
  }

  if (selectedTask) {
    return (
      <main className="popup-shell">
        <TaskDetail
          task={selectedTask}
          loading={loading}
          error={error}
          onBack={() => setSelectedTask(null)}
          onPause={pauseTask}
          onResume={resumeTask}
          onDelete={deleteTask}
          languageControl={<LanguageSelect locale={locale} onLocaleChange={changeLocale} t={t} />}
          t={t}
        />
      </main>
    );
  }

  return (
    <main className="popup-shell">
      <TaskList
        tasks={tasks}
        loading={loading}
        error={error}
        onRefresh={loadTasks}
        onAddClick={() => void openAddView()}
        onTaskClick={setSelectedTask}
        onTaskAction={controlTaskFromList}
        languageControl={<LanguageSelect locale={locale} onLocaleChange={changeLocale} t={t} />}
        t={t}
      />
    </main>
  );
}

function getInitialAddDownloadUris(): string[] {
  const params = new URLSearchParams(window.location.search);
  if (params.get("view") !== "add") return [];

  const uri = params.get("uri")?.trim();
  if (!uri || !isSupportedDownloadUri(uri)) return [];

  return [uri];
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function LanguageSelect({ locale, onLocaleChange, t }: { locale: Locale; onLocaleChange: (locale: Locale) => void; t: Messages }) {
  return (
    <label className="language-icon-select" title={t.language}>
      <span aria-hidden="true">🌐</span>
      <select aria-label={t.language} value={locale} onChange={(event) => onLocaleChange(event.target.value as Locale)}>
        <option value="en">English</option>
        <option value="zh">中文</option>
      </select>
    </label>
  );
}

function TaskDetail({
  task,
  loading,
  error,
  onBack,
  onPause,
  onResume,
  onDelete,
  languageControl,
  t
}: {
  task: DownloadTask;
  loading: boolean;
  error: string | null;
  onBack: () => void;
  onPause: (task: DownloadTask) => Promise<void>;
  onResume: (task: DownloadTask) => Promise<void>;
  onDelete: (task: DownloadTask) => Promise<void>;
  languageControl?: ReactNode;
  t: Messages;
}) {
  const [copied, setCopied] = useState(false);
  const createdAt = task.createdAt ? new Date(task.createdAt * 1000).toLocaleString() : t.unknown;
  const completedAt = task.completedAt ? new Date(task.completedAt * 1000).toLocaleString() : t.unknown;
  const isFinished = task.status === "finished";
  const isPaused = task.status === "paused";

  async function copyUri() {
    if (!task.uri) return;
    await navigator.clipboard.writeText(task.uri);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <section className="panel">
      <div className="toolbar">
        <h1>{t.detailTitle}</h1>
        <div className="toolbar-right">
          {languageControl}
          <button type="button" className="secondary" onClick={onBack}>
            {t.back}
          </button>
        </div>
      </div>
      <div className="detail-title">
        <strong>{task.title}</strong>
      </div>
      <dl className="detail-list">
        <div>
          <dt>{t.status}</dt>
          <dd>
            <span className={`status status-${task.status}`}>{translateStatus(task.status, t)}</span>
          </dd>
        </div>
        <div>
          <dt>ID</dt>
          <dd>{task.id}</dd>
        </div>
        <div>
          <dt>{t.type}</dt>
          <dd>{task.type ?? t.unknown}</dd>
        </div>
        <div>
          <dt>{t.user}</dt>
          <dd>{task.username ?? t.unknown}</dd>
        </div>
        <div>
          <dt>{t.destination}</dt>
          <dd>{task.destination ?? t.defaultDestination}</dd>
        </div>
        <div>
          <dt>{t.uri}</dt>
          <dd className="detail-uri">
            <span className="break-word">{task.uri ?? t.unknown}</span>
            {task.uri ? (
              <button type="button" className="icon-button" aria-label={t.copyUri} title={t.copyUri} onClick={() => void copyUri()}>
                ⧉
              </button>
            ) : null}
          </dd>
        </div>
        <div>
          <dt>{t.created}</dt>
          <dd>{createdAt}</dd>
        </div>
        <div>
          <dt>{t.completed}</dt>
          <dd>{completedAt}</dd>
        </div>
        <div>
          <dt>{t.progress}</dt>
          <dd>{task.progress}%</dd>
        </div>
        <div>
          <dt>{t.downloaded}</dt>
          <dd>{formatBytes(task.downloadedBytes)}</dd>
        </div>
        <div>
          <dt>{t.uploaded}</dt>
          <dd>{formatBytes(task.uploadedBytes)}</dd>
        </div>
        <div>
          <dt>{t.totalSize}</dt>
          <dd>{formatBytes(task.totalBytes)}</dd>
        </div>
      </dl>
      <div className="detail-progress">
        <div className="progress" aria-label={`${task.title} detail progress`}>
          <span style={{ width: `${task.progress}%` }} />
        </div>
      </div>
      {copied ? <p className="notice success">{t.copied}</p> : null}
      {task.error ? <p className="error">{task.error}</p> : null}
      {error ? <p className="error">{error}</p> : null}
      <div className="detail-actions">
        {!isFinished && !isPaused ? (
          <button type="button" disabled={loading} onClick={() => void onPause(task)}>
            {t.pauseTask}
          </button>
        ) : null}
        {!isFinished && isPaused ? (
          <button type="button" disabled={loading} onClick={() => void onResume(task)}>
            {t.resumeTask}
          </button>
        ) : null}
        <button type="button" className="danger" disabled={loading} onClick={() => void onDelete(task)}>
          {t.deleteTask}
        </button>
      </div>
    </section>
  );
}

function SetupForm({
  settings,
  loading,
  error,
  onSubmit,
  languageControl,
  t
}: {
  settings: ConnectionSettings;
  loading: boolean;
  error: string | null;
  onSubmit: (settings: ConnectionSettings) => Promise<void>;
  languageControl?: ReactNode;
  t: Messages;
}) {
  const [draft, setDraft] = useState(settings);
  const usesHttp = draft.baseUrl.trim().startsWith("http://");

  return (
    <form
      className="panel"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit(draft);
      }}
    >
      <div className="toolbar">
        <h1>Download Station</h1>
        {languageControl}
      </div>
      <label>
        {t.dsmUrl}
        <input
          aria-label={t.dsmUrl}
          value={draft.baseUrl}
          onChange={(event) => setDraft({ ...draft, baseUrl: event.target.value })}
          placeholder="https://nas.local:5001"
        />
      </label>
      <label>
        {t.username}
        <input aria-label={t.username} value={draft.username} onChange={(event) => setDraft({ ...draft, username: event.target.value })} />
      </label>
      <label>
        {t.password}
        <input
          aria-label={t.password}
          type="password"
          value={draft.password}
          onChange={(event) => setDraft({ ...draft, password: event.target.value })}
        />
      </label>
      {usesHttp ? <p className="warning">{t.httpWarning}</p> : null}
      {error ? <p className="error">{error}</p> : null}
      <button type="submit" disabled={loading}>
        {loading ? t.connecting : t.saveAndConnect}
      </button>
    </form>
  );
}

function validateSetupUrl(value: string, t: Messages): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return t.invalidScheme;
    }
    if (url.username || url.password) {
      return t.noCredentialsInUrl;
    }
    return null;
  } catch {
    return t.enterValidUrl;
  }
}

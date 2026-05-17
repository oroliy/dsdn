import { useEffect, useState } from "react";
import { AddDownload } from "./AddDownload";
import { sendMessage } from "./api";
import { formatBytes, TaskList, translateStatus } from "./TaskList";
import { getMessages, type Locale, type Messages } from "./i18n";
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
  const [destinations, setDestinations] = useState<DestinationOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    void sendMessage({ type: "settings.get" }).then((response) => {
      if (!mounted) return;
      if (!response.ok || !response.data) {
        setView("setup");
        return;
      }
      setSettings(response.data);
      setView("tasks");
      void loadTasks();
    });
    return () => {
      mounted = false;
    };
  }, []);

  async function loadTasks() {
    setLoading(true);
    setError(null);
    const response = await sendMessage({ type: "tasks.list" });
    setLoading(false);
    if (!response.ok) {
      setError(response.error.message);
      if (response.error.code === "auth_failed" || response.error.code === "settings_missing") {
        setView("setup");
      }
      return;
    }
    setTasks(response.data);
  }

  async function openAddView() {
    setView("add");
    setError(null);
    const response = await sendMessage({ type: "destinations.list" });
    if (!response.ok) {
      setError(response.error.message);
      setDestinations([]);
      return;
    }
    setDestinations(response.data);
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
    setView("tasks");
    await loadTasks();
  }

  async function createDownload(uris: string[], destination?: string) {
    setLoading(true);
    setError(null);
    const response = await sendMessage({ type: "downloads.create", uris, destination });
    setLoading(false);
    if (!response.ok) {
      setError(response.error.message);
      return;
    }
    setView("tasks");
    await loadTasks();
  }

  if (view === "loading") {
    return <main className="popup-shell"><LanguageSelect locale={locale} onLocaleChange={setLocale} t={t} /><p className="muted">{t.loading}</p></main>;
  }

  if (view === "setup") {
    return (
      <main className="popup-shell">
        <LanguageSelect locale={locale} onLocaleChange={setLocale} t={t} />
        <SetupForm settings={settings} loading={loading} error={error} onSubmit={saveAndConnect} t={t} />
      </main>
    );
  }

  if (view === "add") {
    return (
      <main className="popup-shell">
        <LanguageSelect locale={locale} onLocaleChange={setLocale} t={t} />
        <AddDownload
          loading={loading}
          error={error}
          destinations={destinations}
          onCancel={() => setView("tasks")}
          onCreate={createDownload}
          t={t}
        />
      </main>
    );
  }

  if (selectedTask) {
    return (
      <main className="popup-shell">
        <LanguageSelect locale={locale} onLocaleChange={setLocale} t={t} />
        <TaskDetail task={selectedTask} onBack={() => setSelectedTask(null)} t={t} />
      </main>
    );
  }

  return (
    <main className="popup-shell">
      <LanguageSelect locale={locale} onLocaleChange={setLocale} t={t} />
      <TaskList
        tasks={tasks}
        loading={loading}
        error={error}
        onRefresh={loadTasks}
        onAddClick={openAddView}
        onTaskClick={setSelectedTask}
        t={t}
      />
    </main>
  );
}

function LanguageSelect({ locale, onLocaleChange, t }: { locale: Locale; onLocaleChange: (locale: Locale) => void; t: Messages }) {
  return (
    <label className="language-select">
      {t.language}
      <select aria-label={t.language} value={locale} onChange={(event) => onLocaleChange(event.target.value as Locale)}>
        <option value="en">English</option>
        <option value="zh">中文</option>
      </select>
    </label>
  );
}

function TaskDetail({ task, onBack, t }: { task: DownloadTask; onBack: () => void; t: Messages }) {
  const createdAt = task.createdAt ? new Date(task.createdAt * 1000).toLocaleString() : t.unknown;
  const completedAt = task.completedAt ? new Date(task.completedAt * 1000).toLocaleString() : t.unknown;

  return (
    <section className="panel">
      <div className="toolbar">
        <h1>{t.detailTitle}</h1>
        <button type="button" className="secondary" onClick={onBack}>
          {t.back}
        </button>
      </div>
      <div className="detail-title">
        <strong>{task.title}</strong>
        <span className={`status status-${task.status}`}>{translateStatus(task.status, t)}</span>
      </div>
      <dl className="detail-list">
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
          <dd className="break-word">{task.uri ?? t.unknown}</dd>
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
      {task.error ? <p className="error">{task.error}</p> : null}
    </section>
  );
}

function SetupForm({
  settings,
  loading,
  error,
  onSubmit,
  t
}: {
  settings: ConnectionSettings;
  loading: boolean;
  error: string | null;
  onSubmit: (settings: ConnectionSettings) => Promise<void>;
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
      <h1>Download Station</h1>
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

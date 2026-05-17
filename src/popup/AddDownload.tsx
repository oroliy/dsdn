import { useMemo, useState } from "react";
import type { Messages } from "./i18n";
import type { DestinationOption } from "../shared/types";

type AddDownloadProps = {
  loading: boolean;
  error: string | null;
  destinations?: DestinationOption[];
  onCancel: () => void;
  onCreate: (uris: string[], destination?: string) => Promise<void>;
  t: Messages;
};

export function AddDownload({ loading, error, destinations = [], onCancel, onCreate, t }: AddDownloadProps) {
  const [input, setInput] = useState("");
  const [destination, setDestination] = useState("");
  const [customDestination, setCustomDestination] = useState("");
  const uris = useMemo(() => parseDownloadUris(input), [input]);
  const invalidUris = uris.filter((uri) => !isSupportedDownloadUri(uri));
  const canSubmit = uris.length > 0 && invalidUris.length === 0 && !loading;
  const selectedDestination = destination === "__custom" ? customDestination.trim() : destination;

  return (
    <form
      className="panel"
      onSubmit={(event) => {
        event.preventDefault();
        if (canSubmit) {
          void onCreate(uris, selectedDestination || undefined);
        }
      }}
    >
      <div className="toolbar">
        <h1>{t.addDownload}</h1>
        <button type="button" className="secondary" onClick={onCancel}>
          {t.cancel}
        </button>
      </div>
      <label>
        {t.urlsOrMagnets}
        <textarea
          aria-label={t.urlsOrMagnets}
          rows={5}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="https://example.com/file.iso&#10;magnet:?xt=urn:btih:..."
        />
      </label>
      <label>
        {t.destination}
        <select aria-label={t.destination} value={destination} onChange={(event) => setDestination(event.target.value)}>
          <option value="">{t.defaultDestination}</option>
          {destinations.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
          <option value="__custom">{t.custom}</option>
        </select>
      </label>
      {destination === "__custom" ? (
        <label>
          {t.customDestination}
          <input
            aria-label={t.customDestination}
            value={customDestination}
            onChange={(event) => setCustomDestination(event.target.value)}
            placeholder="SharedFolder/path"
          />
        </label>
      ) : null}
      {invalidUris.length > 0 ? <p className="error">{t.invalidDownloadUri}</p> : null}
      {error ? <p className="error">{error}</p> : null}
      <button type="submit" disabled={!canSubmit}>
        {loading ? t.adding : t.addDownload}
      </button>
    </form>
  );
}

export function parseDownloadUris(input: string): string[] {
  return input
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function isSupportedDownloadUri(value: string): boolean {
  if (value.startsWith("magnet:?")) return true;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" || url.protocol === "ftp:";
  } catch {
    return false;
  }
}

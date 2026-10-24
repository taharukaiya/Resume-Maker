"use client";
import { useState } from "react";
import type { Media } from "@/modules/media/service";
import { Button } from "./ui";

export type RemovedUpload = Pick<
  Media,
  "id" | "filename" | "mime" | "bytes" | "created_at" | "removed_at"
>;

/** Contextual controls beside document/image uploads, not a separate library. */
export function UploadManager({
  files,
  removed,
  kind,
  busy,
  onRemove,
  onRestore,
}: {
  files: Media[];
  removed: RemovedUpload[];
  kind: "documents" | "images";
  busy: boolean;
  onRemove: (file: Media) => Promise<void>;
  onRestore: (file: RemovedUpload) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(10);
  const matches = (file: RemovedUpload) =>
    (kind === "images"
      ? file.mime.startsWith("image/")
      : file.mime === "application/pdf") &&
    file.filename.toLowerCase().includes(query.toLowerCase());
  const active = files.filter(matches);
  const archived = removed.filter(matches);
  return (
    <details className="editor-options full-span">
      <summary>Manage uploaded {kind}</summary>
      <p className="panel-description">
        Remove unused uploads from the choices above. Files used in a draft must
        be unselected and the draft saved first. Removed uploads can be
        restored; retained files still count toward storage. Published websites
        stay unchanged.
      </p>
      <input
        type="search"
        aria-label={`Find uploaded ${kind}`}
        placeholder="Find a file by name"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setLimit(10);
        }}
      />
      <div className="file-list">
        {active.slice(0, limit).map((file) => (
          <div className="file-row" key={file.id}>
            <div className="file-info">
              <strong>{file.filename}</strong>
              <small>
                {Math.ceil(file.bytes / 1024)} KB ·{" "}
                {new Date(file.created_at).toLocaleDateString()}
              </small>
            </div>
            <Button
              variant="secondary small"
              disabled={busy}
              aria-label={`Remove upload ${file.filename}`}
              onClick={() => void onRemove(file)}
            >
              Remove upload
            </Button>
          </div>
        ))}
      </div>
      {active.length > limit && (
        <Button variant="secondary small" onClick={() => setLimit(limit + 10)}>
          Show more uploads
        </Button>
      )}
      {!active.length && <p className="muted">No matching uploads.</p>}
      {!!archived.length && (
        <details className="editor-options">
          <summary>
            Removed {kind} ({archived.length})
          </summary>
          <div className="file-list">
            {archived.slice(0, limit).map((file) => (
              <div className="file-row" key={file.id}>
                <div className="file-info">
                  <strong>{file.filename}</strong>
                </div>
                <Button
                  variant="secondary small"
                  disabled={busy}
                  aria-label={`Restore upload ${file.filename}`}
                  onClick={() => void onRestore(file)}
                >
                  Restore
                </Button>
              </div>
            ))}
          </div>
          {archived.length > limit && (
            <Button
              variant="secondary small"
              onClick={() => setLimit(limit + 10)}
            >
              Show more removed uploads
            </Button>
          )}
        </details>
      )}
    </details>
  );
}

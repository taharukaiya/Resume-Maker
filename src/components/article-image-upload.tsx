"use client";
import { useState } from "react";
import { Field } from "./ui";

export type ArticleImageUpload = (
  entryId: string,
  file: File,
  target: "cover" | "figure" | "document",
) => Promise<void>;

export function ArticleImageUploader({
  entryId,
  target,
  onUpload,
}: {
  entryId: string;
  target: "cover" | "figure" | "document";
  onUpload: ArticleImageUpload;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  return (
    <div className="stack">
      <Field
        label={
          target === "document"
            ? "Upload attached document"
            : target === "cover"
              ? "Upload cover image"
              : "Upload article image"
        }
        hint={
          target === "document"
            ? "PDF or Word, up to 20 MB. Selected automatically; existing article text is preserved."
            : "JPG, PNG or WebP, up to 20 MB. Selected automatically after upload."
        }
      >
        <input
          type="file"
          accept={
            target === "document"
              ? ".pdf,.doc,.docx"
              : "image/jpeg,image/png,image/webp"
          }
          disabled={busy}
          onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            setError("");
            setMessage("");
            if (
              (target === "document"
                ? !/\.(pdf|docx?)$/i.test(file.name)
                : !["image/jpeg", "image/png", "image/webp"].includes(
                    file.type,
                  )) ||
              file.size > 20 * 1024 * 1024
            ) {
              setError(
                target === "document"
                  ? "Choose a PDF or Word document smaller than 20 MB."
                  : "Choose a JPG, PNG or WebP image smaller than 20 MB.",
              );
              return;
            }
            setBusy(true);
            try {
              await onUpload(entryId, file, target);
              setMessage(
                "File added to your draft. Review it, then save when ready.",
              );
            } catch (error) {
              setError(
                error instanceof Error
                  ? error.message
                  : "Upload failed. Please try again.",
              );
            } finally {
              setBusy(false);
            }
          }}
        />
      </Field>
      {busy && <p role="status">Uploading file…</p>}
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}

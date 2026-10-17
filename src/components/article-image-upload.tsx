"use client";
import { useState } from "react";
import { Field } from "./ui";

export type ArticleImageUpload = (
  entryId: string,
  file: File,
  target: "cover" | "figure",
) => Promise<void>;

export function ArticleImageUploader({
  entryId,
  target,
  onUpload,
}: {
  entryId: string;
  target: "cover" | "figure";
  onUpload: ArticleImageUpload;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  return (
    <div className="stack">
      <Field
        label={
          target === "cover" ? "Upload cover image" : "Upload article image"
        }
        hint="JPG, PNG or WebP, up to 20 MB. Selected automatically after upload."
      >
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={busy}
          onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            setError("");
            setMessage("");
            if (
              !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
              file.size > 20 * 1024 * 1024
            ) {
              setError("Choose a JPG, PNG or WebP image smaller than 20 MB.");
              return;
            }
            setBusy(true);
            try {
              await onUpload(entryId, file, target);
              setMessage(
                "Image added to your draft. Review it, then save when ready.",
              );
            } catch (error) {
              setError(
                error instanceof Error
                  ? error.message
                  : "Image upload failed. Please try again.",
              );
            } finally {
              setBusy(false);
            }
          }}
        />
      </Field>
      {busy && <p role="status">Uploading image…</p>}
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}

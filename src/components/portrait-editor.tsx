"use client";
import Image from "next/image";
import { ImagePlus } from "lucide-react";
import type { Media } from "@/modules/media/service";
import { api, Field, Feedback, useFeedback } from "./ui";

export function PortraitEditor({
  siteId,
  media,
  value,
  editable,
  uploadAllowed,
  demo,
  onSelect,
  onUploaded,
}: {
  siteId: string;
  media: Media[];
  value: string;
  editable: boolean;
  uploadAllowed: boolean;
  demo: boolean;
  onSelect: (id: string) => void;
  onUploaded: (id: string) => Promise<void>;
}) {
  const feedback = useFeedback();
  return (
    <div className="portrait-editor full-span">
      <div className="portrait-preview">
        {value ? (
          <Image
            src={`/api/media/${value}`}
            alt="Selected profile photo"
            fill
            sizes="112px"
            unoptimized
          />
        ) : (
          <ImagePlus size={28} aria-hidden="true" />
        )}
      </div>
      <div className="portrait-fields">
        <Field
          label="Profile photo"
          hint={
            editable && uploadAllowed
              ? "Choose an existing image or upload a new photo below."
              : "Managed by your administrator"
          }
        >
          <select
            value={value}
            disabled={!editable || feedback.busy}
            onChange={(e) => onSelect(e.target.value)}
          >
            <option value="">No photo selected</option>
            {media
              .filter((m) => m.mime.startsWith("image/"))
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.filename}
                </option>
              ))}
          </select>
        </Field>
        {editable && uploadAllowed && (
          <Field
            label="Upload profile photo"
            hint={`JPG, PNG or WebP, up to ${demo ? 5 : 20} MB. Photos are optimized automatically. Save the draft to keep your selection.`}
          >
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
              disabled={feedback.busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                void feedback.run(async () => {
                  if (!/\.(jpe?g|png|webp)$/i.test(file.name))
                    throw new Error("Choose a JPG, PNG or WebP image.");
                  if (file.size > (demo ? 5 : 20) * 1024 * 1024)
                    throw new Error(
                      `Choose an image smaller than ${demo ? 5 : 20} MB.`,
                    );
                  const form = new FormData();
                  form.append("file", file);
                  form.append("purpose", "image");
                  const result = await api<{ id: string }>(
                    `sites/${siteId}/media`,
                    { method: "POST", body: form },
                  );
                  await onUploaded(result.id);
                }, "Photo uploaded and selected. Save the draft when ready.");
              }}
            />
          </Field>
        )}
        {feedback.busy && <p role="status">Uploading and optimizing photo…</p>}
        <Feedback {...feedback} />
      </div>
    </div>
  );
}

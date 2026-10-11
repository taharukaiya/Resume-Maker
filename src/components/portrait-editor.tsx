"use client";
import Image from "next/image";
import { ImagePlus, WandSparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Media } from "@/modules/media/service";
import { removePortraitBackground } from "@/modules/media/portrait-background";
import { api, Button, Field, Feedback, useFeedback } from "./ui";

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
  const [automatic, setAutomatic] = useState(true);
  const [progress, setProgress] = useState("");
  const [original, setOriginal] = useState("");
  const [cutout, setCutout] = useState("");
  const controller = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      controller.current?.abort();
    };
  }, []);
  async function storePhoto(file: File) {
    const form = new FormData();
    form.append("file", file);
    form.append("purpose", "image");
    const result = await api<{ id: string }>(`sites/${siteId}/media`, {
      method: "POST",
      body: form,
    });
    if (mounted.current) await onUploaded(result.id);
    return result.id;
  }
  async function processPhoto(
    file: Blob,
    originalId: string,
    filename: string,
  ) {
    if (!mounted.current) return;
    setOriginal(originalId);
    setCutout("");
    const abort = new AbortController();
    controller.current = abort;
    try {
      const result = await removePortraitBackground(
        file,
        setProgress,
        abort.signal,
      );
      controller.current = null;
      if (result.unchanged) {
        feedback.setMessage(
          "This photo already has transparency. Its background was left unchanged.",
        );
        return;
      }
      setProgress("Saving your transparent portrait…");
      const id = await storePhoto(
        new File(
          [result.blob],
          `${filename.replace(/\.[^.]+$/, "")}-transparent.webp`,
          { type: result.blob.type },
        ),
      );
      setCutout(id);
      feedback.setMessage(
        "Transparent portrait selected. Check the edges in Preview; you can switch back to the original below.",
      );
    } finally {
      controller.current = null;
      setProgress("");
    }
  }
  return (
    <div className="portrait-editor full-span">
      <div className="portrait-preview transparency-grid">
        {value ? (
          <Image
            src={`/api/media/${value}`}
            alt="Selected profile photo"
            fill
            sizes="160px"
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
              ? "The original stays in your media library. Save the draft to keep your selection."
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
          <>
            <label className="check-row photo-automatic">
              <input
                type="checkbox"
                checked={automatic}
                disabled={feedback.busy}
                onChange={(e) => setAutomatic(e.target.checked)}
              />
              <span>
                <strong>Automatically remove the portrait background</strong>
                <small>
                  Transparent photos are kept as they are. Free processing runs
                  in your browser; the first use downloads a model.
                </small>
              </span>
            </label>
            <Field
              label="Upload profile photo"
              hint={`JPG, PNG or WebP, up to ${demo ? 5 : 20} MB. Best with a clear photo of one person.`}
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
                    setProgress("Uploading the original photo…");
                    try {
                      const id = await storePhoto(file);
                      if (!mounted.current) return;
                      setOriginal(id);
                      setCutout("");
                      if (automatic) await processPhoto(file, id, file.name);
                      else
                        feedback.setMessage(
                          "Photo uploaded and selected. Save the draft when ready.",
                        );
                    } finally {
                      setProgress("");
                    }
                  });
                }}
              />
            </Field>
            <div className="row wrap photo-actions">
              {value && (
                <Button
                  variant="secondary small"
                  busy={feedback.busy}
                  onClick={() =>
                    void feedback.run(async () => {
                      const response = await fetch(`/api/media/${value}`);
                      if (!response.ok)
                        throw new Error(
                          "The selected photo could not be read.",
                        );
                      await processPhoto(
                        await response.blob(),
                        value,
                        media.find((m) => m.id === value)?.filename ||
                          "portrait.png",
                      );
                    })
                  }
                >
                  <WandSparkles size={14} /> Remove background from selected
                  photo
                </Button>
              )}
              {original && cutout && !feedback.busy && (
                <>
                  <Button
                    variant="secondary small"
                    onClick={() => onSelect(original)}
                    disabled={value === original}
                  >
                    Use original
                  </Button>
                  <Button
                    variant="secondary small"
                    onClick={() => onSelect(cutout)}
                    disabled={value === cutout}
                  >
                    Use transparent version
                  </Button>
                </>
              )}
              {feedback.busy && controller.current && (
                <Button
                  variant="secondary small"
                  onClick={() => controller.current?.abort()}
                >
                  Cancel background removal
                </Button>
              )}
            </div>
          </>
        )}
        {progress && (
          <p role="status" className="photo-progress">
            {progress}
          </p>
        )}
        <Feedback {...feedback} />
      </div>
    </div>
  );
}

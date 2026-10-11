"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, Button, Field, Feedback, useFeedback } from "./ui";

export function DeleteDraft({
  id,
  name,
  slug,
  revision,
  busy,
  onDeleted,
}: {
  id: string;
  name: string;
  slug: string;
  revision: number;
  busy: boolean;
  onDeleted?: () => void;
}) {
  const router = useRouter();
  const feedback = useFeedback();
  const [open, setOpen] = useState(false),
    [confirmation, setConfirmation] = useState(""),
    [deleted, setDeleted] = useState(false);
  return (
    <section className="panel danger-zone">
      <h3>Delete draft portfolio</h3>
      <p className="panel-description">
        Permanently remove {name}, its saved revisions, files and extracted CV
        details. The client account and audit history are retained. This cannot
        be undone. File cleanup runs in the background; backup retention still
        applies.
      </p>
      <Feedback {...feedback} />
      {!open ? (
        <Button variant="danger" disabled={busy} onClick={() => setOpen(true)}>
          Delete draft portfolio
        </Button>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void feedback.run(async () => {
              await api(`sites/${id}`, {
                method: "DELETE",
                body: JSON.stringify({ slug: confirmation, revision }),
              });
              setDeleted(true);
              onDeleted?.();
              // Refreshing the old route here can cancel the replacement.
              router.replace("/studio/portfolios");
            });
          }}
        >
          <Field label={`Type ${slug} to confirm deletion`}>
            <input
              value={confirmation}
              autoComplete="off"
              onChange={(e) => setConfirmation(e.target.value)}
            />
          </Field>
          <div className="row" style={{ marginTop: 16 }}>
            <Button
              type="submit"
              variant="danger"
              busy={feedback.busy}
              disabled={busy || deleted || confirmation !== slug}
            >
              Permanently delete draft
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={feedback.busy}
              onClick={() => {
                setOpen(false);
                setConfirmation("");
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
      {busy && (
        <p className="muted">
          Wait for background jobs and saves to finish before deleting.
        </p>
      )}
    </section>
  );
}

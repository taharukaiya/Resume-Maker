"use client";
import { useId, useState } from "react";
import { api, Button, Field, Feedback, Modal, useFeedback } from "./ui";

export function DeletePortfolio({
  id,
  name,
  slug,
  revision,
  published,
  busy = false,
  onClose,
  onDeleted,
}: {
  id: string;
  name: string;
  slug: string;
  revision: number;
  published: boolean;
  busy?: boolean;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const feedback = useFeedback();
  const descriptionId = useId();
  const [confirmation, setConfirmation] = useState("");
  const [deleted, setDeleted] = useState(false);
  return (
    <Modal
      title="Delete portfolio?"
      role="alertdialog"
      descriptionId={descriptionId}
      onClose={() => {
        if (!feedback.busy && !deleted) onClose();
      }}
    >
      <div id={descriptionId} className="panel-description">
        <p>
          Permanently delete <strong>{name}</strong>, including its saved
          revisions, published releases, files, extracted CV details and inbox
          messages. This cannot be undone. The client account and audit history
          are retained.
        </p>
        {published && (
          <p>
            This portfolio is live. Deleting it also takes the website offline.
            Cached pages may remain visible for several minutes.
          </p>
        )}
        <p>
          File cleanup runs in the background; backup retention still applies.
        </p>
      </div>
      <Feedback {...feedback} />
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (busy || feedback.busy || deleted || confirmation !== slug) return;
          void feedback.run(async () => {
            await api(`sites/${id}`, {
              method: "DELETE",
              body: JSON.stringify({
                slug: confirmation,
                revision,
                deletePublished: published,
              }),
            });
            setDeleted(true);
            onDeleted();
          });
        }}
      >
        <Field label={`Type ${slug} to confirm deletion`}>
          <input
            data-autofocus
            value={confirmation}
            autoComplete="off"
            spellCheck={false}
            disabled={feedback.busy || deleted}
            onChange={(event) => setConfirmation(event.target.value)}
          />
        </Field>
        {busy && (
          <p className="muted">
            Wait for background jobs and saves to finish before deleting.
          </p>
        )}
        <div className="form-actions">
          <Button
            type="button"
            variant="secondary"
            disabled={feedback.busy || deleted}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="danger"
            busy={feedback.busy}
            disabled={busy || deleted || confirmation !== slug}
          >
            Permanently delete portfolio
          </Button>
        </div>
      </form>
    </Modal>
  );
}

"use client";
import { useEffect, useRef, useState } from "react";
import type { AiTask } from "@/modules/ai/documents";
import { api, Button } from "./ui";

export function useDocumentAi() {
  const [progress, setProgress] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function run(id: string, task: AiTask, browser: boolean) {
    if (!browser) {
      const { jobId } = await api<{ jobId: string }>(`media/${id}/${task}`, {
        method: "POST",
      });
      return {
        jobId,
        message:
          "Processing queued. This page will update when the proposal is ready.",
      };
    }
    controller.current = new AbortController();
    const signal = controller.current.signal;
    setProgress("Reading the PDF text…");
    try {
      const { text } = await api<{ text: string }>(`media/${id}/browser-ai`, {
        method: "POST",
        body: JSON.stringify({ task }),
        signal,
      });
      const { inferInBrowser } = await import("@/modules/ai/browser");
      const result = await inferInBrowser(text, task, setProgress, signal);
      signal.throwIfAborted();
      await api(`media/${id}/browser-ai`, {
        method: "PUT",
        body: JSON.stringify({ task, result }),
        signal,
      });
      return {
        result,
        message:
          "Proposal ready. Review it against the original document before applying or publishing.",
      };
    } finally {
      setProgress("");
      controller.current = null;
    }
  }
  return { run, progress, cancel: () => controller.current?.abort() };
}

export function AiProgress({
  progress,
  cancel,
}: {
  progress: string;
  cancel: () => void;
}) {
  if (!progress) return null;
  return (
    <div className="notice info" role="status" aria-live="polite">
      <span>{progress}</span>
      <Button type="button" variant="secondary small" onClick={cancel}>
        Cancel AI
      </Button>
    </div>
  );
}

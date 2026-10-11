export type PortraitResult = { blob: Blob; unchanged: boolean };

export async function removePortraitBackground(
  file: Blob,
  progress: (message: string) => void,
  signal: AbortSignal,
): Promise<PortraitResult> {
  signal.throwIfAborted();
  const worker = new Worker(new URL("./portrait.worker.ts", import.meta.url), {
    type: "module",
  });
  let timer: ReturnType<typeof setTimeout>;
  let cancel: () => void = () => {};
  try {
    return await new Promise<PortraitResult>((resolve, reject) => {
      cancel = () =>
        reject(
          new Error(
            "Background removal cancelled. Your original photo is still available.",
          ),
        );
      signal.addEventListener("abort", cancel, { once: true });
      timer = setTimeout(
        () =>
          reject(
            new Error(
              "Background removal took too long. Retry, or use the original photo.",
            ),
          ),
        180000,
      );
      worker.onerror = () =>
        reject(
          new Error(
            "This browser could not start the photo processor. Try current Chrome, Edge, or Firefox, or use the original photo.",
          ),
        );
      worker.onmessage = (event: MessageEvent) => {
        if (event.data.progress) progress(event.data.progress);
        else if (event.data.error) reject(new Error(event.data.error));
        else resolve(event.data.result);
      };
      worker.postMessage(file);
    });
  } finally {
    clearTimeout(timer!);
    signal.removeEventListener("abort", cancel);
    worker.terminate();
  }
}

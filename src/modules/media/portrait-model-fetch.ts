/** Bounded downloads with a fresh Hub redirect on retry; never send photo data. */
export function portraitModelFetch(progress: (message: string) => void) {
  return async (input: string | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(input);
    const modelFile = url.pathname.endsWith(".onnx");
    for (let attempt = 0; attempt < 2; attempt++) {
      const target = new URL(url);
      if (target.hostname === "huggingface.co" && modelFile) {
        target.searchParams.set("download", "true");
        if (attempt) target.searchParams.set("retry", String(Date.now()));
      }
      const abort = new AbortController();
      const timer = setTimeout(() => abort.abort(), 60000);
      try {
        const response = await fetch(target, {
          ...init,
          signal: abort.signal,
          credentials: "omit",
          cache: "no-store",
        });
        if (response.status === 429 || response.status >= 500) {
          await response.body?.cancel();
          throw new Error("The model host is temporarily unavailable.");
        }
        if (!response.ok || !response.body) return response;
        const reader = response.body.getReader();
        const parts: Uint8Array[] = [];
        const total = Number(response.headers.get("content-length"));
        let loaded = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          parts.push(value);
          loaded += value.length;
          if (modelFile)
            progress(
              total > 0
                ? `Downloading photo model: ${Math.min(100, Math.round((100 * loaded) / total))}%`
                : `Downloading photo model: ${(loaded / 1048576).toFixed(1)} MB`,
            );
        }
        const data = new Uint8Array(loaded);
        let offset = 0;
        for (const part of parts) {
          data.set(part, offset);
          offset += part.length;
        }
        const headers = new Headers(response.headers);
        headers.set("content-length", String(loaded));
        headers.delete("content-encoding");
        return new Response(data, {
          status: response.status,
          statusText: response.statusText,
          headers,
        });
      } catch (error) {
        if (attempt === 1) throw error;
        progress("The model download was interrupted. Retrying once…");
      } finally {
        clearTimeout(timer);
      }
    }
    throw new Error("The model download failed.");
  };
}

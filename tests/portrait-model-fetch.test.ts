import { afterEach, expect, it, vi } from "vitest";
import { portraitModelFetch } from "../src/modules/media/portrait-model-fetch";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it("retries an interrupted model download with a fresh redirect and preserves bytes", async () => {
  const fetcher = vi
    .fn()
    .mockRejectedValueOnce(new TypeError("Connection reset"))
    .mockResolvedValueOnce(
      new Response(new Uint8Array([1, 2, 3]), {
        headers: { "content-length": "3" },
      }),
    );
  vi.stubGlobal("fetch", fetcher);
  const progress = vi.fn();
  const result = await portraitModelFetch(progress)(
    "https://huggingface.co/Xenova/modnet/resolve/revision/onnx/model.onnx",
  );
  expect(new Uint8Array(await result.arrayBuffer())).toEqual(
    new Uint8Array([1, 2, 3]),
  );
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(fetcher.mock.calls[0][0].searchParams.get("download")).toBe("true");
  expect(fetcher.mock.calls[1][0].searchParams.has("retry")).toBe(true);
  expect(fetcher.mock.calls[1][1]).toMatchObject({
    credentials: "omit",
    cache: "no-store",
  });
  expect(progress).toHaveBeenCalledWith(
    "The model download was interrupted. Retrying once…",
  );
});

it("does not retry missing or access-restricted files", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue(new Response("Missing", { status: 404 }));
  vi.stubGlobal("fetch", fetcher);
  const response = await portraitModelFetch(() => {})(
    "https://huggingface.co/Xenova/modnet/resolve/revision/config.json",
  );
  expect(response.status).toBe(404);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it("aborts stalled requests and stops after one retry", async () => {
  vi.useFakeTimers();
  const fetcher = vi.fn().mockImplementation(
    (_url, options) =>
      new Promise((_resolve, reject) => {
        options.signal.addEventListener(
          "abort",
          () => reject(new Error("Timed out")),
          { once: true },
        );
      }),
  );
  vi.stubGlobal("fetch", fetcher);
  const result = portraitModelFetch(() => {})(
    "https://huggingface.co/Xenova/modnet/resolve/revision/onnx/model.onnx",
  ).catch((error) => error);
  await vi.advanceTimersByTimeAsync(120000);
  expect((await result).message).toBe("Timed out");
  expect(fetcher).toHaveBeenCalledTimes(2);
});

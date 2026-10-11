import { hasTransparency, usableMatte } from "./portrait-alpha";
import { portraitModelFetch } from "./portrait-model-fetch";

self.onmessage = async (event: MessageEvent<Blob>) => {
  const progress = (message: string) => self.postMessage({ progress: message });
  try {
    progress("Checking the photo’s transparency…");
    const bitmap = await createImageBitmap(event.data);
    if (bitmap.width * bitmap.height > 40000000) {
      bitmap.close();
      throw new Error("Choose a photo smaller than 40 megapixels.");
    }
    const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
    const canvas = new OffscreenCanvas(
      Math.max(1, Math.round(bitmap.width * scale)),
      Math.max(1, Math.round(bitmap.height * scale)),
    );
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
      bitmap.close();
      throw new Error("Your browser could not read this photo.");
    }
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    if (hasTransparency(pixels.data)) {
      self.postMessage({ result: { blob: event.data, unchanged: true } });
      return;
    }
    progress(
      "Preparing the free photo model. The first use downloads model files; your photo is not sent to the model provider.",
    );
    const {
      env,
      AutoModelForImageSegmentation,
      AutoProcessor,
      BackgroundRemovalPipeline,
      RawImage,
    } = await import("@huggingface/transformers");
    env.allowLocalModels = false;
    env.fetch = portraitModelFetch(progress);
    env.backends.onnx.wasm!.numThreads = 1;
    // Load the pinned components directly. The generic pipeline factory probes
    // main-revision metadata separately, adding unnecessary ranged downloads.
    const revision = "fa2fa546052fba4c08921230a26cc69a333fca12";
    const model = await AutoModelForImageSegmentation.from_pretrained(
      "Xenova/modnet",
      {
        device: "wasm",
        dtype: "fp32",
        revision,
      },
    );
    try {
      const processor = await AutoProcessor.from_pretrained("Xenova/modnet", {
        revision,
      });
      const segmenter = new BackgroundRemovalPipeline({
        task: "background-removal",
        model,
        processor,
      });
      progress("Removing the background…");
      const output = await segmenter(
        new RawImage(pixels.data, canvas.width, canvas.height, 4),
      );
      const image = Array.isArray(output) ? output[0] : output;
      if (!usableMatte(image.data))
        throw new Error(
          "A clear portrait could not be separated from this background. Try a well-lit photo of one person, or keep the original.",
        );
      self.postMessage({
        result: {
          blob: await image.toBlob("image/webp", 0.94),
          unchanged: false,
        },
      });
    } finally {
      await model.dispose();
    }
  } catch (error) {
    self.postMessage({
      error:
        error instanceof Error &&
        /Choose a photo|Your browser|clear portrait/.test(error.message)
          ? error.message
          : "The photo model could not download or process this image. Check your connection and retry, or use the original photo.",
    });
  }
};

/** Browser inference never falls back to a paid API. */
export function aiConfig() {
  const provider = process.env.AI_PROVIDER || "openai";
  return {
    provider,
    enabled:
      provider === "huggingface-browser" ||
      (provider === "openai" &&
        !!process.env.OPENAI_API_KEY &&
        !!process.env.OPENAI_MODEL),
  };
}

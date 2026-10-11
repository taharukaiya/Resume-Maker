/** Browser inference never falls back to a paid API. */
export function aiConfig() {
  const provider = process.env.AI_PROVIDER || "openai";
  const server =
    (provider === "openai" &&
      !!process.env.OPENAI_API_KEY &&
      !!process.env.OPENAI_MODEL) ||
    (provider === "gemini" &&
      !!process.env.GEMINI_API_KEY &&
      !!process.env.GEMINI_MODEL);
  return {
    provider,
    server,
    enabled: provider === "huggingface-browser" || server,
  };
}

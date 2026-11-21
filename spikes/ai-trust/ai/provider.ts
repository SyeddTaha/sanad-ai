import type { ProviderCompletion, ReliefMessageProvider } from "./assess-message";

export type SpikeProviderConfig = {
  provider: "gemini" | "groq" | "openai";
  apiKey: string;
  model: string;
  baseUrl?: string;
};

const DEFAULT_MODELS = {
  gemini: "gemini-2.5-flash",
  groq: "llama-3.3-70b-versatile",
  openai: "gpt-4o-mini",
} as const;

export function providerConfigFromEnv(env: NodeJS.ProcessEnv = process.env): SpikeProviderConfig | null {
  const provider = env.SANAD_SPIKE_AI_PROVIDER;
  if (provider === "gemini" || provider === "groq" || provider === "openai") {
    const apiKey = env.SANAD_SPIKE_AI_API_KEY;
    if (!apiKey) return null;
    return {
      provider,
      apiKey,
      model: env.SANAD_SPIKE_AI_MODEL || DEFAULT_MODELS[provider],
      baseUrl: env.SANAD_SPIKE_AI_BASE_URL,
    };
  }
  if (env.GEMINI_API_KEY || env.GOOGLE_API_KEY) {
    return {
      provider: "gemini",
      apiKey: env.GEMINI_API_KEY || env.GOOGLE_API_KEY || "",
      model: env.SANAD_SPIKE_AI_MODEL || DEFAULT_MODELS.gemini,
    };
  }
  if (env.GROQ_API_KEY) {
    return { provider: "groq", apiKey: env.GROQ_API_KEY, model: env.SANAD_SPIKE_AI_MODEL || DEFAULT_MODELS.groq };
  }
  if (env.OPENAI_API_KEY) {
    return { provider: "openai", apiKey: env.OPENAI_API_KEY, model: env.SANAD_SPIKE_AI_MODEL || DEFAULT_MODELS.openai };
  }
  return null;
}

export function createReliefMessageProvider(
  config: SpikeProviderConfig,
  fetchImpl: typeof fetch = fetch,
): ReliefMessageProvider {
  if (config.provider === "gemini") return geminiProvider(config, fetchImpl);
  return openAiCompatibleProvider(config, fetchImpl);
}

function geminiProvider(config: SpikeProviderConfig, fetchImpl: typeof fetch): ReliefMessageProvider {
  return {
    name: "gemini",
    model: config.model,
    async complete({ system, user, signal }) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}:generateContent`;
      const response = await fetchImpl(url, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": config.apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: user }] }],
          generationConfig: { temperature: 0, responseMimeType: "application/json" },
        }),
        signal,
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) throw providerHttpError(response.status);
      const text = geminiText(body);
      if (!text) throw providerHttpError(response.status);
      return { text, tokenUsage: geminiUsage(body) };
    },
  };
}

function openAiCompatibleProvider(config: SpikeProviderConfig, fetchImpl: typeof fetch): ReliefMessageProvider {
  const baseUrl = config.baseUrl
    ?? (config.provider === "groq" ? "https://api.groq.com/openai/v1" : "https://api.openai.com/v1");
  return {
    name: config.provider,
    model: config.model,
    async complete({ system, user, signal }) {
      const response = await fetchImpl(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
        signal,
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) throw providerHttpError(response.status);
      const text = openAiText(body);
      if (!text) throw providerHttpError(response.status);
      return { text, tokenUsage: openAiUsage(body) };
    },
  };
}

function providerHttpError(status: number): Error {
  const error = new Error(`PROVIDER_HTTP_${status}`);
  error.name = "ProviderHttpError";
  return error;
}

function geminiText(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const candidates = (body as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates) || !candidates[0] || typeof candidates[0] !== "object") return null;
  const parts = (candidates[0] as { content?: { parts?: unknown } }).content?.parts;
  if (!Array.isArray(parts)) return null;
  const text = parts
    .map((part) => (part && typeof part === "object" && "text" in part ? String(part.text ?? "") : ""))
    .join("");
  return text || null;
}

function openAiText(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const choices = (body as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || !choices[0] || typeof choices[0] !== "object") return null;
  const content = (choices[0] as { message?: { content?: unknown } }).message?.content;
  return typeof content === "string" && content.length > 0 ? content : null;
}

function openAiUsage(body: unknown): ProviderCompletion["tokenUsage"] {
  if (!body || typeof body !== "object") return null;
  const usage = (body as { usage?: unknown }).usage;
  if (!usage || typeof usage !== "object") return null;
  const record = usage as { prompt_tokens?: unknown; completion_tokens?: unknown; total_tokens?: unknown };
  return {
    input: count(record.prompt_tokens),
    output: count(record.completion_tokens),
    total: count(record.total_tokens),
  };
}

function geminiUsage(body: unknown): ProviderCompletion["tokenUsage"] {
  if (!body || typeof body !== "object") return null;
  const metadata = (body as { usageMetadata?: unknown }).usageMetadata;
  if (!metadata || typeof metadata !== "object") return null;
  const record = metadata as { promptTokenCount?: unknown; candidatesTokenCount?: unknown; totalTokenCount?: unknown };
  return {
    input: count(record.promptTokenCount),
    output: count(record.candidatesTokenCount),
    total: count(record.totalTokenCount),
  };
}

function count(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

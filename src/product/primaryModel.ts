export type PrimaryModelProvider =
  | "OpenRouter"
  | "OpenAI"
  | "Anthropic"
  | "Google Gemini"
  | "Fireworks"
  | "Hugging Face";

export type PrimaryModelConfig = {
  status: "ready" | "missing_key";
  provider: PrimaryModelProvider;
  model: string;
  providerModel: string;
  apiKeyEnv: string;
  baseUrl: string | null;
  maxOutputTokens: number;
  openAICompatible: boolean;
  missing: string[];
  uses: string[];
  updatedAt: string;
};

type Env = Record<string, string | undefined>;

const DEFAULT_MODEL = "openrouter/google/gemini-3.1-pro-preview-customtools";
const DEFAULT_MAX_OUTPUT_TOKENS = 8192;

export function readPrimaryModelConfig(env: Env = process.env): PrimaryModelConfig {
  const model = readValue(env.PRIMARY_MODEL_ID) || readValue(env.LITELLM_MODEL_ID) || DEFAULT_MODEL;
  const provider = readProvider(model, env.PRIMARY_MODEL_PROVIDER);
  const apiKeyEnv = readApiKeyEnv(provider);
  const ready = hasValue(env[apiKeyEnv]);

  return {
    status: ready ? "ready" : "missing_key",
    provider,
    model,
    providerModel: toProviderModel(model, provider),
    apiKeyEnv,
    baseUrl: readBaseUrl(provider, env),
    maxOutputTokens: readMaxOutputTokens(env.PRIMARY_MODEL_MAX_OUTPUT_TOKENS),
    openAICompatible: isOpenAICompatible(provider),
    missing: ready ? [] : [apiKeyEnv],
    uses: [
      "agent thesis synthesis",
      "research-source summary",
      "probability-model explanation",
      "policy and safety review",
      "demo narrative generation",
    ],
    updatedAt: new Date().toISOString(),
  };
}

function readProvider(model: string, override: string | undefined): PrimaryModelProvider {
  const normalizedOverride = readValue(override).toLowerCase();
  if (normalizedOverride === "openrouter") return "OpenRouter";
  if (normalizedOverride === "openai") return "OpenAI";
  if (normalizedOverride === "anthropic") return "Anthropic";
  if (normalizedOverride === "google" || normalizedOverride === "gemini") return "Google Gemini";
  if (normalizedOverride === "fireworks") return "Fireworks";
  if (normalizedOverride === "huggingface") return "Hugging Face";

  const normalizedModel = model.toLowerCase();
  if (normalizedModel.startsWith("openrouter/")) return "OpenRouter";
  if (normalizedModel.startsWith("fireworks") || normalizedModel.startsWith("fireworks_ai/")) {
    return "Fireworks";
  }
  if (normalizedModel.startsWith("anthropic/") || normalizedModel.includes("claude")) {
    return "Anthropic";
  }
  if (normalizedModel.startsWith("gemini/") || normalizedModel.startsWith("google/")) {
    return "Google Gemini";
  }
  if (normalizedModel.startsWith("huggingface/")) return "Hugging Face";
  return "OpenAI";
}

function readApiKeyEnv(provider: PrimaryModelProvider) {
  if (provider === "OpenRouter") return "OPENROUTER_API_KEY";
  if (provider === "Anthropic") return "ANTHROPIC_API_KEY";
  if (provider === "Google Gemini") return "GEMINI_API_KEY";
  if (provider === "Fireworks") return "FIREWORKS_API_KEY";
  if (provider === "Hugging Face") return "HUGGINGFACE_API_KEY";
  return "OPENAI_API_KEY";
}

function readBaseUrl(provider: PrimaryModelProvider, env: Env) {
  if (provider === "OpenRouter") {
    return readValue(env.PRIMARY_MODEL_BASE_URL) || "https://openrouter.ai/api/v1";
  }
  if (provider === "OpenAI") {
    return readValue(env.PRIMARY_MODEL_BASE_URL) || readValue(env.OPENAI_BASE_URL) || "https://api.openai.com/v1";
  }
  if (provider === "Fireworks") {
    return readValue(env.PRIMARY_MODEL_BASE_URL) || "https://api.fireworks.ai/inference/v1";
  }
  if (provider === "Google Gemini") {
    return readValue(env.PRIMARY_MODEL_BASE_URL) || "https://generativelanguage.googleapis.com/v1beta/openai";
  }
  return readValue(env.PRIMARY_MODEL_BASE_URL) || null;
}

function toProviderModel(model: string, provider: PrimaryModelProvider) {
  if (provider === "OpenRouter") return model.replace(/^openrouter\//i, "");
  if (provider === "Fireworks") return model.replace(/^fireworks_ai\//i, "");
  if (provider === "OpenAI") return model.replace(/^openai\//i, "");
  if (provider === "Google Gemini") return model.replace(/^google\//i, "");
  if (provider === "Anthropic") return model.replace(/^anthropic\//i, "");
  if (provider === "Hugging Face") return model.replace(/^huggingface\//i, "");
  return model;
}

function isOpenAICompatible(provider: PrimaryModelProvider) {
  return (
    provider === "OpenRouter" ||
    provider === "OpenAI" ||
    provider === "Fireworks" ||
    provider === "Google Gemini"
  );
}

function readMaxOutputTokens(value: string | undefined) {
  const parsed = Number(readValue(value));
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_MAX_OUTPUT_TOKENS;
  return Math.max(512, Math.min(131072, Math.floor(parsed)));
}

function hasValue(value: string | undefined) {
  return readValue(value) !== "";
}

function readValue(value: string | undefined) {
  return value?.trim() ?? "";
}

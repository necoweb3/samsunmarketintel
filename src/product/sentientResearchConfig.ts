export type SentientReadinessStatus =
  | "ready"
  | "needs_search_provider"
  | "needs_reranker"
  | "needs_model"
  | "not_configured";

export type OpenDeepSearchMode = "default" | "pro";
export type OpenDeepSearchProvider = "serper" | "searxng";
export type OpenDeepSearchReranker = "jina" | "infinity";

type Env = Record<string, string | undefined>;

export type SentientResearchConfig = {
  status: SentientReadinessStatus;
  mode: OpenDeepSearchMode;
  search: {
    provider: OpenDeepSearchProvider;
    label: string;
    ready: boolean;
    required: string[];
  };
  reranker: {
    provider: OpenDeepSearchReranker;
    label: string;
    ready: boolean;
    endpoint: string | null;
    required: string[];
  };
  model: {
    name: string;
    provider: string;
    ready: boolean;
    required: string[];
  };
  missing: string[];
  recommendedStack: string[];
  updatedAt: string;
};

const DEFAULT_MODEL = "openrouter/google/gemini-3.1-pro-preview-customtools";
const DEFAULT_INFINITY_ENDPOINT = "http://localhost:7997/embeddings";

export function readSentientResearchConfig(env: Env = process.env): SentientResearchConfig {
  const mode = readMode(env.OPENDEEPSEARCH_MODE);
  const searchProvider = readSearchProvider(env);
  const rerankerProvider = readReranker(env);
  const modelName = readValue(env.LITELLM_SEARCH_MODEL_ID) || readValue(env.LITELLM_MODEL_ID) || DEFAULT_MODEL;

  const search = buildSearchConfig(searchProvider, env);
  const reranker = buildRerankerConfig(rerankerProvider, env);
  const model = buildModelConfig(modelName, env);
  const missing = [...search.required, ...reranker.required, ...model.required];
  const status = pickStatus(search.ready, reranker.ready, model.ready);

  return {
    status,
    mode,
    search,
    reranker,
    model,
    missing,
    recommendedStack: [
      "Serper for reliable web result discovery",
      "Jina AI for semantic reranking without local GPU setup",
      "LiteLLM with a strong hosted reasoning model",
      "Circle x402 remains the paid market-data rail",
      "Arc remains the final proof and receipt layer",
    ],
    updatedAt: new Date().toISOString(),
  };
}

function buildSearchConfig(provider: OpenDeepSearchProvider, env: Env) {
  if (provider === "searxng") {
    const ready = hasValue(env.SEARXNG_INSTANCE_URL);
    return {
      provider,
      label: "SearXNG",
      ready,
      required: ready ? [] : ["SEARXNG_INSTANCE_URL"],
    };
  }

  const ready = hasValue(env.SERPER_API_KEY);
  return {
    provider,
    label: "Serper",
    ready,
    required: ready ? [] : ["SERPER_API_KEY"],
  };
}

function buildRerankerConfig(provider: OpenDeepSearchReranker, env: Env) {
  if (provider === "infinity") {
    const endpoint = readValue(env.OPENDEEPSEARCH_INFINITY_ENDPOINT) || DEFAULT_INFINITY_ENDPOINT;
    const configured = hasValue(env.OPENDEEPSEARCH_INFINITY_ENDPOINT);
    return {
      provider,
      label: "Infinity",
      ready: configured,
      endpoint,
      required: configured ? [] : [`Infinity server at ${DEFAULT_INFINITY_ENDPOINT}`],
    };
  }

  const ready = hasValue(env.JINA_API_KEY);
  return {
    provider,
    label: "Jina AI",
    ready,
    endpoint: null,
    required: ready ? [] : ["JINA_API_KEY"],
  };
}

function buildModelConfig(modelName: string, env: Env) {
  const provider = inferModelProvider(modelName);
  const required = inferModelRequirements(provider, env);

  return {
    name: modelName,
    provider,
    ready: required.length === 0,
    required,
  };
}

function inferModelProvider(modelName: string) {
  const normalized = modelName.toLowerCase();
  if (normalized.startsWith("openrouter/")) return "OpenRouter";
  if (normalized.startsWith("fireworks") || normalized.startsWith("fireworks_ai/")) return "Fireworks";
  if (normalized.startsWith("anthropic/") || normalized.includes("claude")) return "Anthropic";
  if (normalized.startsWith("gemini/") || normalized.startsWith("google/")) return "Google Gemini";
  if (normalized.startsWith("huggingface/")) return "Hugging Face";
  return "OpenAI";
}

function inferModelRequirements(provider: string, env: Env) {
  if (provider === "OpenRouter") return hasValue(env.OPENROUTER_API_KEY) ? [] : ["OPENROUTER_API_KEY"];
  if (provider === "Fireworks") return hasValue(env.FIREWORKS_API_KEY) ? [] : ["FIREWORKS_API_KEY"];
  if (provider === "Anthropic") return hasValue(env.ANTHROPIC_API_KEY) ? [] : ["ANTHROPIC_API_KEY"];
  if (provider === "Google Gemini") {
    return hasValue(env.GEMINI_API_KEY) || hasValue(env.GOOGLE_API_KEY)
      ? []
      : ["GEMINI_API_KEY or GOOGLE_API_KEY"];
  }
  if (provider === "Hugging Face") return hasValue(env.HUGGINGFACE_API_KEY) ? [] : ["HUGGINGFACE_API_KEY"];
  return hasValue(env.OPENAI_API_KEY) ? [] : ["OPENAI_API_KEY"];
}

function pickStatus(searchReady: boolean, rerankerReady: boolean, modelReady: boolean): SentientReadinessStatus {
  if (searchReady && rerankerReady && modelReady) return "ready";
  if (!searchReady && !rerankerReady && !modelReady) return "not_configured";
  if (!searchReady) return "needs_search_provider";
  if (!rerankerReady) return "needs_reranker";
  return "needs_model";
}

function readSearchProvider(env: Env): OpenDeepSearchProvider {
  const provider = readValue(env.OPENDEEPSEARCH_SEARCH_PROVIDER)?.toLowerCase();
  if (provider === "searxng") return "searxng";
  if (provider === "serper") return "serper";
  return hasValue(env.SEARXNG_INSTANCE_URL) && !hasValue(env.SERPER_API_KEY) ? "searxng" : "serper";
}

function readReranker(env: Env): OpenDeepSearchReranker {
  const reranker = readValue(env.OPENDEEPSEARCH_RERANKER)?.toLowerCase();
  if (reranker === "infinity") return "infinity";
  if (reranker === "jina") return "jina";
  return "jina";
}

function readMode(value: string | undefined): OpenDeepSearchMode {
  return readValue(value)?.toLowerCase() === "default" ? "default" : "pro";
}

function hasValue(value: string | undefined) {
  return readValue(value) !== "";
}

function readValue(value: string | undefined) {
  return value?.trim() ?? "";
}

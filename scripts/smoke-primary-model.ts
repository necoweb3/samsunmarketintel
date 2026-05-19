import "dotenv/config";

import OpenAI from "openai";

import { readPrimaryModelConfig } from "../src/product/primaryModel.js";

const config = readPrimaryModelConfig();

if (config.status !== "ready") {
  throw new Error(`Primary model is missing ${config.missing.join(", ")}.`);
}

if (!config.openAICompatible || !config.baseUrl) {
  throw new Error(`${config.provider} is configured, but this smoke test expects an OpenAI-compatible endpoint.`);
}

const apiKey = process.env[config.apiKeyEnv];
if (!apiKey) {
  throw new Error(`Primary model is missing ${config.apiKeyEnv}.`);
}

const client = new OpenAI({
  apiKey,
  baseURL: config.baseUrl,
  defaultHeaders:
    config.provider === "OpenRouter"
      ? {
          "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3050",
          "X-Title": "Samsun Market Intel",
        }
      : undefined,
});

const response = await client.chat.completions.create({
  model: config.providerModel,
  messages: [
    {
      role: "system",
      content:
        "You are testing a prediction-market research agent. Reply with one short sentence.",
    },
    {
      role: "user",
      content: "Say that the primary model route is ready for live agent trials.",
    },
  ],
  max_tokens: Math.min(config.maxOutputTokens, 8192),
  temperature: 0,
});

console.log(
  JSON.stringify(
    {
      provider: config.provider,
      model: config.model,
      providerModel: config.providerModel,
      ok: true,
      output: response.choices[0]?.message?.content ?? "",
    },
    null,
    2,
  ),
);

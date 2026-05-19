import "dotenv/config";

import { readPrimaryModelConfig } from "../src/product/primaryModel.js";

const config = readPrimaryModelConfig();

console.log(
  JSON.stringify(
    {
      status: config.status,
      provider: config.provider,
      model: config.model,
      providerModel: config.providerModel,
      apiKeyEnv: config.apiKeyEnv,
      baseUrl: config.baseUrl,
      maxOutputTokens: config.maxOutputTokens,
      openAICompatible: config.openAICompatible,
      missing: config.missing,
      uses: config.uses,
    },
    null,
    2,
  ),
);

if (process.argv.includes("--strict") && config.status !== "ready") {
  process.exitCode = 1;
}

import "dotenv/config";

import { readSentientResearchConfig } from "../src/product/sentientResearchConfig.js";

const config = readSentientResearchConfig();

console.log(
  JSON.stringify(
    {
      status: config.status,
      mode: config.mode,
      search: {
        provider: config.search.provider,
        ready: config.search.ready,
        required: config.search.required,
      },
      reranker: {
        provider: config.reranker.provider,
        ready: config.reranker.ready,
        endpoint: config.reranker.endpoint,
        required: config.reranker.required,
      },
      model: {
        name: config.model.name,
        provider: config.model.provider,
        ready: config.model.ready,
        required: config.model.required,
      },
      missing: config.missing,
    },
    null,
    2,
  ),
);

if (process.argv.includes("--strict") && config.status !== "ready") {
  process.exitCode = 1;
}

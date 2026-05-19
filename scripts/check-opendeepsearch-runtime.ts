import "dotenv/config";

import {
  readOpenDeepSearchRuntime,
  runOpenDeepSearch,
} from "../src/product/openDeepSearchRuntime.js";

const runtime = readOpenDeepSearchRuntime();
const live = process.argv.includes("--live");

if (!live) {
  console.log(
    JSON.stringify(
      {
        status: runtime.status,
        missing: runtime.missing,
        config: {
          status: runtime.config.status,
          mode: runtime.config.mode,
          search: runtime.config.search.label,
          reranker: runtime.config.reranker.label,
          model: runtime.config.model.name,
        },
        runtime: {
          python: runtime.pythonPath ? "ready" : "missing",
          script: runtime.scriptPath ? "ready" : "missing",
        },
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

const query =
  process.argv.find((arg) => arg.startsWith("--query="))?.slice("--query=".length) ??
  "Turkey CPI surprise prediction market source credibility";

const result = await runOpenDeepSearch({ query });

console.log(
  JSON.stringify(
    {
      status: result.status,
      missing: result.missing,
      durationMs: result.durationMs,
      answerPreview: result.answer?.slice(0, 500) ?? null,
      error: result.error,
    },
    null,
    2,
  ),
);

if (result.status === "error") {
  process.exitCode = 1;
}

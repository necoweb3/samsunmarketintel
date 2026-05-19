import assert from "node:assert/strict";

import { buildAgentRun } from "../src/product/agentRun.js";

const run = buildAgentRun(
  {
    marketId: "draft-integrity-case",
    market: "Suspicious esports prediction-market flow",
    venue: "Draft",
    category: "Market Integrity",
    marketProbability: null,
    agentProbability: 0.5,
    confidence: 0.55,
    risk: "Medium",
    sources: ["User report", "Cached trade-flow scan"],
  },
  [],
);

assert.equal(run.marketId, "draft-integrity-case");
assert.equal(run.venue, "Draft");
assert.equal(run.analysis.marketProbability, null);
assert.equal(run.analysis.agentProbability, 0.5);
assert.equal(run.analysis.inputRisk, "Medium");
assert.equal(run.sizing.side, "NONE");
assert.equal(run.riskGate, "review");

console.log(
  JSON.stringify(
    {
      status: "ok",
      target: {
        marketId: run.marketId,
        market: run.market,
        riskGate: run.riskGate,
        marketProbability: run.analysis.marketProbability,
        agentProbability: run.analysis.agentProbability,
        inputRisk: run.analysis.inputRisk,
      },
    },
    null,
    2,
  ),
);

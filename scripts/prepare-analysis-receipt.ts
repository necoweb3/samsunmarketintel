import "dotenv/config";

import {
  ANALYSIS_RECEIPT_FUNCTION,
  buildAnalysisReceiptArgs,
  stableJson,
  type AnalysisReceiptInput,
} from "../src/arc/analysisReceipt.js";

const sampleInput: AnalysisReceiptInput = {
  marketId: "polymarket:sample-btc-above-120k-june-2026",
  marketProbability: 0.42,
  agentProbability: 0.49,
  confidence: 0.68,
  decision: "BET_YES",
  riskLevel: "LOW",
  runId: `run-${new Date().toISOString()}`,
  sources: [
    "circle:x402:polymarket-markets",
    "source:sample-news-cluster",
    "source:sample-orderbook",
  ],
  notes: "Sample receipt payload for Arc integration testing.",
};

const args = buildAnalysisReceiptArgs(sampleInput);
const contract = process.env.ANALYSIS_RECEIPT_CONTRACT ?? "$env:ANALYSIS_RECEIPT_CONTRACT";
const wallet =
  process.env.ARC_TESTNET_AGENT_WALLET_ADDRESS ??
  process.env.CIRCLE_AGENT_WALLET_ADDRESS ??
  "$env:ARC_TESTNET_AGENT_WALLET_ADDRESS";

const command = [
  "& 'C:\\Users\\pc\\AppData\\Roaming\\npm\\circle.cmd'",
  "wallet execute",
  `"${ANALYSIS_RECEIPT_FUNCTION}"`,
  ...args.map(String),
  "--contract",
  contract,
  "--address",
  wallet,
  "--chain",
  "ARC-TESTNET",
  "--rpc-url",
  "$env:ARC_TESTNET_RPC_URL",
  "--testnet",
  "--output",
  "json",
].join(" ");

console.log(
  JSON.stringify(
    {
      input: sampleInput,
      stablePayload: stableJson(sampleInput),
      functionSignature: ANALYSIS_RECEIPT_FUNCTION,
      args,
      circleCliCommand: command,
    },
    null,
    2,
  ),
);

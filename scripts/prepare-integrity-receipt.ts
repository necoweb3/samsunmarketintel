import "dotenv/config";

import { readFile, stat } from "node:fs/promises";

import { ANALYSIS_RECEIPT_FUNCTION } from "../src/arc/analysisReceipt.js";
import { buildIntegrityDecision } from "../src/product/agentDecision.js";
import { buildIntegritySnapshot } from "../src/product/integrityAnalysis.js";

const DEFAULT_TRADES_CACHE = ".cache/x402/latest-polymarket-trades.json";

const [raw, fileStat] = await Promise.all([
  readFile(DEFAULT_TRADES_CACHE, "utf8"),
  stat(DEFAULT_TRADES_CACHE),
]);
const payload = JSON.parse(raw.replace(/^\uFEFF/, "")) as unknown;
const snapshot = buildIntegritySnapshot(payload);
const topAlert = snapshot.alerts[0];

if (!topAlert) {
  throw new Error("No integrity alert found. Run npm run x402:pay:trades first.");
}

const decision = buildIntegrityDecision({
  alert: topAlert,
  payment: snapshot.payment,
  updatedAt: fileStat.mtime.toISOString(),
});
const contract = process.env.ANALYSIS_RECEIPT_CONTRACT ?? "$env:ANALYSIS_RECEIPT_CONTRACT";
const wallet =
  process.env.ARC_TESTNET_AGENT_WALLET_ADDRESS ??
  process.env.CIRCLE_AGENT_WALLET_ADDRESS ??
  "$env:ARC_TESTNET_AGENT_WALLET_ADDRESS";

const command = [
  "circle",
  "wallet execute",
  `"${ANALYSIS_RECEIPT_FUNCTION}"`,
  ...decision.receiptArgs.map(String),
  "--contract",
  contract,
  "--address",
  wallet,
  "--chain",
  "ARC-TESTNET",
  "--rpc-url",
  "$env:ARC_TESTNET_RPC_URL",
  "--output",
  "json",
].join(" ");

console.log(
  JSON.stringify(
    {
      alert: topAlert,
      decision,
      functionSignature: ANALYSIS_RECEIPT_FUNCTION,
      circleCliCommand: command,
    },
    null,
    2,
  ),
);

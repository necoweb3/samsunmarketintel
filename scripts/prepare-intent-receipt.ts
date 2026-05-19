import "dotenv/config";

import { buildIntentReceiptCandidate } from "../src/product/intentReceipt.js";
import { readIntentLedger } from "../src/product/intentLedger.js";

const ledger = await readIntentLedger();
const intentId = process.argv[2];
const intent = intentId
  ? ledger.intents.find((item) => item.id === intentId)
  : ledger.intents[0];

if (!intent) {
  throw new Error("No staged intent found. Use the dashboard or POST /api/agent/intent first.");
}

const candidate = buildIntentReceiptCandidate({
  intent,
  contract: process.env.ANALYSIS_RECEIPT_CONTRACT,
  wallet:
    process.env.ARC_TESTNET_AGENT_WALLET_ADDRESS ?? process.env.CIRCLE_AGENT_WALLET_ADDRESS,
});

console.log(JSON.stringify(candidate, null, 2));

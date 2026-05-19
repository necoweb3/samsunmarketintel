import "dotenv/config";

import { createPublicClient, http, isAddress } from "viem";
import { arcTestnet } from "viem/chains";

import {
  analysisReceiptAbi,
  ARC_TESTNET_CHAIN_ID,
} from "../src/arc/analysisReceipt.js";
import { buildIntentReceiptCandidate } from "../src/product/intentReceipt.js";
import { readIntentLedger } from "../src/product/intentLedger.js";

const rpcUrl =
  process.env.ARC_TESTNET_RPC_URL ?? process.env.ARC_CANTEEN_RPC_URL ?? process.env.RPC;
const contractAddress = process.env.ANALYSIS_RECEIPT_CONTRACT;
const agentWallet =
  process.env.ARC_TESTNET_AGENT_WALLET_ADDRESS ?? process.env.CIRCLE_AGENT_WALLET_ADDRESS;
const intentId = process.argv[2];

if (!rpcUrl) {
  throw new Error("Missing ARC_TESTNET_RPC_URL, ARC_CANTEEN_RPC_URL, or RPC in .env");
}

if (!contractAddress || !isAddress(contractAddress)) {
  throw new Error("Missing ANALYSIS_RECEIPT_CONTRACT in .env");
}

if (!agentWallet || !isAddress(agentWallet)) {
  throw new Error("Missing ARC_TESTNET_AGENT_WALLET_ADDRESS or CIRCLE_AGENT_WALLET_ADDRESS in .env");
}

const ledger = await readIntentLedger();
const intent = intentId
  ? ledger.intents.find((item) => item.id === intentId)
  : ledger.intents[0];

if (!intent) {
  throw new Error("No staged intent found. Use the dashboard or POST /api/agent/intent first.");
}

const candidate = buildIntentReceiptCandidate({
  intent,
  contract: contractAddress,
  wallet: agentWallet,
});
const client = createPublicClient({
  chain: arcTestnet,
  transport: http(rpcUrl),
});
const chainId = await client.getChainId();

if (chainId !== ARC_TESTNET_CHAIN_ID) {
  throw new Error(`Expected Arc Testnet chain id ${ARC_TESTNET_CHAIN_ID}, got ${chainId}`);
}

const gas = await client.estimateContractGas({
  account: agentWallet,
  address: contractAddress,
  abi: analysisReceiptAbi,
  functionName: "recordReceipt",
  args: candidate.receiptArgs,
});

console.log(
  JSON.stringify(
    {
      chainId,
      contractAddress,
      agentWallet,
      intentId: intent.id,
      receiptInput: candidate.receiptInput,
      receiptArgs: candidate.receiptArgs,
      estimatedGas: gas.toString(),
    },
    null,
    2,
  ),
);

import "dotenv/config";

import { mkdir, writeFile } from "node:fs/promises";

import {
  createPublicClient,
  createWalletClient,
  http,
  isAddress,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
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
const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
const intentId = process.argv[2];

if (!rpcUrl) {
  throw new Error("Missing ARC_TESTNET_RPC_URL, ARC_CANTEEN_RPC_URL, or RPC in .env");
}

if (!contractAddress || !isAddress(contractAddress)) {
  throw new Error("Missing ANALYSIS_RECEIPT_CONTRACT in .env");
}

if (!privateKey || !/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
  throw new Error("Missing DEPLOYER_PRIVATE_KEY in .env for local fallback signing.");
}

const ledger = await readIntentLedger();
const intent = intentId
  ? ledger.intents.find((item) => item.id === intentId)
  : ledger.intents[0];

if (!intent) {
  throw new Error("No staged intent found. Use the dashboard or POST /api/agent/intent first.");
}

const account = privateKeyToAccount(privateKey as Hex);
const candidate = buildIntentReceiptCandidate({
  intent,
  contract: contractAddress,
  wallet: account.address,
});
const publicClient = createPublicClient({
  chain: arcTestnet,
  transport: http(rpcUrl),
});
const walletClient = createWalletClient({
  account,
  chain: arcTestnet,
  transport: http(rpcUrl),
});

const chainId = await publicClient.getChainId();
if (chainId !== ARC_TESTNET_CHAIN_ID) {
  throw new Error(`Expected Arc Testnet chain id ${ARC_TESTNET_CHAIN_ID}, got ${chainId}`);
}

const receiptId = await publicClient.readContract({
  address: contractAddress,
  abi: analysisReceiptAbi,
  functionName: "nextReceiptId",
});
const hash = await walletClient.writeContract({
  account,
  address: contractAddress,
  abi: analysisReceiptAbi,
  functionName: "recordReceipt",
  args: candidate.receiptArgs,
});
const transactionReceipt = await publicClient.waitForTransactionReceipt({ hash });
const nextReceiptId = await publicClient.readContract({
  address: contractAddress,
  abi: analysisReceiptAbi,
  functionName: "nextReceiptId",
});
const recordedReceipt = await publicClient.readContract({
  address: contractAddress,
  abi: analysisReceiptAbi,
  functionName: "getReceipt",
  args: [receiptId],
});

const output = {
  chainId,
  contractAddress,
  agentWallet: account.address,
  recordingMode: "local-deployer-fallback",
  expectedReceiptId: receiptId.toString(),
  nextReceiptId: nextReceiptId.toString(),
  transactionHash: hash,
  explorerUrl: `https://testnet.arcscan.app/tx/${hash}`,
  intent,
  candidate,
  transactionReceipt,
  recordedReceipt,
};

await mkdir(".cache/arc", { recursive: true });
await writeFile(
  ".cache/arc/latest-intent-receipt.json",
  JSON.stringify(output, (_, value: unknown) => (typeof value === "bigint" ? value.toString() : value), 2),
);

console.log(
  JSON.stringify(output, (_, value: unknown) => (typeof value === "bigint" ? value.toString() : value), 2),
);

import "dotenv/config";
import { createPublicClient, http, isAddress } from "viem";
import { arcTestnet } from "viem/chains";

import { analysisReceiptAbi, ARC_TESTNET_CHAIN_ID } from "../src/arc/analysisReceipt.js";

const rpcUrl =
  process.env.ARC_TESTNET_RPC_URL ??
  process.env.ARC_CANTEEN_RPC_URL ??
  process.env.RPC;
const contractAddress = process.env.ANALYSIS_RECEIPT_CONTRACT;
const receiptId = BigInt(process.argv[2] ?? "0");

if (rpcUrl === undefined || rpcUrl === "") {
  throw new Error("Missing ARC_TESTNET_RPC_URL, ARC_CANTEEN_RPC_URL, or RPC in .env");
}

if (contractAddress === undefined || !isAddress(contractAddress)) {
  throw new Error("Missing ANALYSIS_RECEIPT_CONTRACT in .env");
}

const client = createPublicClient({
  chain: arcTestnet,
  transport: http(rpcUrl),
});

const chainId = await client.getChainId();
if (chainId !== ARC_TESTNET_CHAIN_ID) {
  throw new Error(`Expected Arc Testnet chain id ${ARC_TESTNET_CHAIN_ID}, got ${chainId}`);
}

const [nextReceiptId, receipt] = await Promise.all([
  client.readContract({
    address: contractAddress,
    abi: analysisReceiptAbi,
    functionName: "nextReceiptId",
  }),
  client.readContract({
    address: contractAddress,
    abi: analysisReceiptAbi,
    functionName: "getReceipt",
    args: [receiptId],
  }),
]);

console.log(
  JSON.stringify(
    {
      chainId,
      contractAddress,
      nextReceiptId: nextReceiptId.toString(),
      receiptId: receiptId.toString(),
      receipt,
    },
    (_, value: unknown) => (typeof value === "bigint" ? value.toString() : value),
    2,
  ),
);

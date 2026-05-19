import { keccak256, stringToHex, type Hex } from "viem";
import { z } from "zod";

export const ARC_TESTNET_CHAIN_ID = 5_042_002;

export const ANALYSIS_RECEIPT_FUNCTION =
  "recordReceipt(bytes32,bytes32,bytes32,uint16,uint16,uint16,uint8,uint8)" as const;

export const receiptDecisions = {
  BET_YES: 0,
  BET_NO: 1,
  WAIT: 2,
  DO_NOT_BET: 3,
  HEDGE: 4,
  CLOSE_EARLY: 5,
} as const;

export const receiptRiskLevels = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
  BLOCKED: 3,
} as const;

export const analysisReceiptAbi = [
  {
    type: "function",
    name: "nextReceiptId",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "getReceipt",
    stateMutability: "view",
    inputs: [{ name: "receiptId", type: "uint256" }],
    outputs: [
      {
        name: "receipt",
        type: "tuple",
        components: [
          { name: "agent", type: "address" },
          { name: "marketIdHash", type: "bytes32" },
          { name: "sourceHash", type: "bytes32" },
          { name: "runHash", type: "bytes32" },
          { name: "marketProbabilityBps", type: "uint16" },
          { name: "agentProbabilityBps", type: "uint16" },
          { name: "edgeBps", type: "int16" },
          { name: "confidenceBps", type: "uint16" },
          { name: "decision", type: "uint8" },
          { name: "riskLevel", type: "uint8" },
          { name: "createdAt", type: "uint64" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "recordReceipt",
    stateMutability: "nonpayable",
    inputs: [
      { name: "marketIdHash", type: "bytes32" },
      { name: "sourceHash", type: "bytes32" },
      { name: "runHash", type: "bytes32" },
      { name: "marketProbabilityBps", type: "uint16" },
      { name: "agentProbabilityBps", type: "uint16" },
      { name: "confidenceBps", type: "uint16" },
      { name: "decision", type: "uint8" },
      { name: "riskLevel", type: "uint8" },
    ],
    outputs: [{ name: "receiptId", type: "uint256" }],
  },
  {
    type: "event",
    name: "ReceiptRecorded",
    inputs: [
      { name: "receiptId", type: "uint256", indexed: true },
      { name: "agent", type: "address", indexed: true },
      { name: "marketIdHash", type: "bytes32", indexed: true },
      { name: "sourceHash", type: "bytes32", indexed: false },
      { name: "runHash", type: "bytes32", indexed: false },
      { name: "marketProbabilityBps", type: "uint16", indexed: false },
      { name: "agentProbabilityBps", type: "uint16", indexed: false },
      { name: "edgeBps", type: "int16", indexed: false },
      { name: "confidenceBps", type: "uint16", indexed: false },
      { name: "decision", type: "uint8", indexed: false },
      { name: "riskLevel", type: "uint8", indexed: false },
    ],
  },
] as const;

export const analysisReceiptInputSchema = z.object({
  marketId: z.string().min(1),
  marketProbability: z.number().min(0).max(1),
  agentProbability: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
  decision: z.enum(["BET_YES", "BET_NO", "WAIT", "DO_NOT_BET", "HEDGE", "CLOSE_EARLY"]),
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH", "BLOCKED"]),
  runId: z.string().min(1),
  sources: z.array(z.string().min(1)).default([]),
  notes: z.string().optional(),
});

export type AnalysisReceiptInput = z.infer<typeof analysisReceiptInputSchema>;

export type AnalysisReceiptArgs = readonly [
  marketIdHash: Hex,
  sourceHash: Hex,
  runHash: Hex,
  marketProbabilityBps: number,
  agentProbabilityBps: number,
  confidenceBps: number,
  decision: number,
  riskLevel: number,
];

export function probabilityToBps(value: number): number {
  const bps = Math.round(value * 10_000);

  if (!Number.isInteger(bps) || bps < 0 || bps > 10_000) {
    throw new Error(`Invalid probability value: ${value}`);
  }

  return bps;
}

export function hashText(value: string): Hex {
  return keccak256(stringToHex(value));
}

export function stableJson(value: unknown): string {
  return JSON.stringify(sortJson(value));
}

export function buildAnalysisReceiptArgs(input: AnalysisReceiptInput): AnalysisReceiptArgs {
  const parsed = analysisReceiptInputSchema.parse(input);
  const sortedSources = [...parsed.sources].sort();
  const sourcePayload = {
    marketId: parsed.marketId,
    sources: sortedSources,
  };
  const runPayload = {
    ...parsed,
    sources: sortedSources,
  };

  return [
    hashText(parsed.marketId),
    hashText(stableJson(sourcePayload)),
    hashText(stableJson(runPayload)),
    probabilityToBps(parsed.marketProbability),
    probabilityToBps(parsed.agentProbability),
    probabilityToBps(parsed.confidence),
    receiptDecisions[parsed.decision],
    receiptRiskLevels[parsed.riskLevel],
  ] as const;
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortJson);
  }

  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nestedValue]) => [key, sortJson(nestedValue)]),
    );
  }

  return value;
}

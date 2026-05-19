export type PositionSizingInput = {
  marketProbability: number | null;
  agentProbability: number;
  confidence: number;
  risk: "Low" | "Medium" | "High";
  bankrollUsdc?: number;
  maxFraction?: number;
};

export type PositionSizingResult = {
  side: "YES" | "NO" | "NONE";
  rawKellyFraction: number;
  confidenceAdjustedFraction: number;
  cappedFraction: number;
  stakeUsdc: number;
  reason: string;
};

export function estimatePositionSize({
  marketProbability,
  agentProbability,
  confidence,
  risk,
  bankrollUsdc = 100,
  maxFraction = 0.03,
}: PositionSizingInput): PositionSizingResult {
  if (marketProbability === null) {
    return emptySizing("Market price is missing.");
  }

  if (risk === "High") {
    return emptySizing("Risk gate blocks sizing.");
  }

  const price = clampProbability(marketProbability);
  const fair = clampProbability(agentProbability);
  const yesKelly = price < 1 ? (fair - price) / (1 - price) : 0;
  const noKelly = price > 0 ? (price - fair) / price : 0;
  const side = yesKelly > 0 || noKelly > 0 ? (yesKelly >= noKelly ? "YES" : "NO") : "NONE";
  const rawKellyFraction = Math.max(0, side === "YES" ? yesKelly : noKelly);
  const riskMultiplier = risk === "Medium" ? 0.5 : 1;
  const confidenceAdjustedFraction = rawKellyFraction * clampProbability(confidence) * riskMultiplier;
  const cappedFraction = Math.min(maxFraction, confidenceAdjustedFraction);

  if (side === "NONE" || cappedFraction <= 0) {
    return emptySizing("No positive expected value after confidence and risk adjustment.");
  }

  return {
    side,
    rawKellyFraction,
    confidenceAdjustedFraction,
    cappedFraction,
    stakeUsdc: bankrollUsdc * cappedFraction,
    reason:
      risk === "Medium"
        ? "Positive edge, but medium risk halves the confidence-adjusted size."
        : "Positive edge with low integrity risk.",
  };
}

function emptySizing(reason: string): PositionSizingResult {
  return {
    side: "NONE",
    rawKellyFraction: 0,
    confidenceAdjustedFraction: 0,
    cappedFraction: 0,
    stakeUsdc: 0,
    reason,
  };
}

function clampProbability(value: number) {
  return Math.min(0.99, Math.max(0.01, value));
}

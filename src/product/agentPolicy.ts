import type { TradeIntent } from "@/src/product/tradeIntent";

export type AgentPolicy = {
  mode: "Manual";
  walletExecution: false;
  limits: {
    perIntentUsdc: number;
    dailyUsdc: number;
    weeklyUsdc: number;
  };
  gates: {
    allowAutonomousBets: false;
    requireHumanConfirmation: true;
    blockHighRisk: true;
    blockMissingSourceConfirmation: true;
  };
};

export type AgentPolicyEvaluation = {
  policy: AgentPolicy;
  ledger: {
    stagedIntents: number;
    last24hIntents: number;
    blockedIntents: number;
    stagedExposureUsdc: number;
    last24hExposureUsdc: number;
    remainingDailyUsdc: number;
  };
  status: "healthy" | "review" | "blocked";
  warnings: string[];
  nextAction: string;
};

export const defaultAgentPolicy: AgentPolicy = {
  mode: "Manual",
  walletExecution: false,
  limits: {
    perIntentUsdc: 3,
    dailyUsdc: 25,
    weeklyUsdc: 100,
  },
  gates: {
    allowAutonomousBets: false,
    requireHumanConfirmation: true,
    blockHighRisk: true,
    blockMissingSourceConfirmation: true,
  },
};

export function evaluateAgentPolicy(
  intents: TradeIntent[],
  policy: AgentPolicy = defaultAgentPolicy,
): AgentPolicyEvaluation {
  const now = Date.now();
  const dayAgo = now - 24 * 60 * 60 * 1000;
  const last24h = intents.filter((intent) => readTimestamp(intent.createdAt) >= dayAgo);
  const blockedIntents = intents.filter((intent) => intent.executionState === "blocked").length;
  const stagedExposureUsdc = sumExposure(intents);
  const last24hExposureUsdc = sumExposure(last24h);
  const remainingDailyUsdc = Math.max(0, policy.limits.dailyUsdc - last24hExposureUsdc);
  const warnings = buildWarnings({ intents, blockedIntents, last24hExposureUsdc, policy });
  const status =
    warnings.some((warning) => warning.includes("Daily limit")) || blockedIntents > 0
      ? "review"
      : "healthy";

  return {
    policy,
    ledger: {
      stagedIntents: intents.length,
      last24hIntents: last24h.length,
      blockedIntents,
      stagedExposureUsdc,
      last24hExposureUsdc,
      remainingDailyUsdc,
    },
    status,
    warnings,
    nextAction: buildNextAction(warnings),
  };
}

function sumExposure(intents: TradeIntent[]) {
  return intents.reduce((sum, intent) => sum + Math.max(0, intent.stakeUsdc || 0), 0);
}

function buildWarnings({
  intents,
  blockedIntents,
  last24hExposureUsdc,
  policy,
}: {
  intents: TradeIntent[];
  blockedIntents: number;
  last24hExposureUsdc: number;
  policy: AgentPolicy;
}) {
  const warnings: string[] = [];

  if (policy.walletExecution === false) {
    warnings.push("Wallet execution is disabled; intents require manual confirmation.");
  }

  if (blockedIntents > 0) {
    warnings.push(`${blockedIntents} staged intent(s) are blocked by risk policy.`);
  }

  if (last24hExposureUsdc >= policy.limits.dailyUsdc) {
    warnings.push("Daily limit reached; new execution intents must be rejected.");
  }

  const oversized = intents.filter((intent) => intent.stakeUsdc > policy.limits.perIntentUsdc);
  if (oversized.length > 0) {
    warnings.push(`${oversized.length} intent(s) exceed per-intent policy cap.`);
  }

  return warnings;
}

function buildNextAction(warnings: string[]) {
  if (warnings.some((warning) => warning.includes("Daily limit"))) {
    return "Reject new execution intents until the daily window resets.";
  }

  if (warnings.some((warning) => warning.includes("blocked"))) {
    return "Review blocked intents before recording further proofs.";
  }

  return "Continue staging intents in manual mode; wallet execution remains off.";
}

function readTimestamp(value: string) {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

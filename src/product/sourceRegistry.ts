import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { turkeyStarterSources } from "@/src/product/starterSources";
import { sourceCredibilityRules, type CredibilityTier } from "@/src/product/sourceCredibility";

export type SourceRegistryRecord = {
  id: string;
  name: string;
  type:
    | "Official data"
    | "Paid data"
    | "Newswire"
    | "Local press"
    | "Social signal"
    | "X account"
    | "Community report";
  coverage: string;
  credibility: CredibilityTier | "Machine-readable" | "Weighted";
  role: string;
  domains: string[];
  weight: number;
  status: "Active" | "Needs curation" | "Watch";
  notes: string;
};

export type SourceRegistryInput = Omit<SourceRegistryRecord, "id" | "weight"> & {
  id?: string;
  weight?: number;
};

const CUSTOM_SOURCE_REGISTRY_PATH = ".cache/sources/registry.json";

export function buildSourceRegistry(): SourceRegistryRecord[] {
  return [
    ...sourceCredibilityRules.map(mapRuleToRecord),
    ...turkeyStarterSources.map(normalizeSourceRegistryInput),
    {
      id: "circle-x402-market-apis",
      name: "Circle x402 market APIs",
      type: "Paid data",
      coverage: "Polymarket, order books, trades",
      credibility: "Machine-readable",
      role: "Market data and flow integrity",
      domains: ["agents.circle.com", "nano.blockrun.ai", "api.aisa.one"],
      weight: 0.82,
      status: "Active",
      notes: "Paid per request through Circle Gateway/x402; raw payloads stay out of git.",
    },
    {
      id: "local-x-macro-list",
      name: "Local X macro list",
      type: "Social signal",
      coverage: "Turkey macro, politics, FX, market rumor flow",
      credibility: "Weighted",
      role: "Early signal before official confirmation",
      domains: ["x.com"],
      weight: 0.42,
      status: "Needs curation",
      notes: "User-provided accounts will be scored by history, source quality, and confirmation rate.",
    },
    {
      id: "operator-integrity-reports",
      name: "Operator integrity reports",
      type: "Social signal",
      coverage: "Sports, esports, and competition-event integrity plus suspicious market movement",
      credibility: "Weighted",
      role: "Integrity watchlist input",
      domains: ["official match pages", "community reports"],
      weight: 0.36,
      status: "Watch",
      notes: "Only used for alerts until corroborated by paid trade-flow data or official event sources.",
    },
  ];
}

export async function readSourceRegistry(path = CUSTOM_SOURCE_REGISTRY_PATH) {
  const custom = await readCustomSourceRegistry(path);
  return dedupeSourceRegistry([...buildSourceRegistry(), ...custom]);
}

export async function readCustomSourceRegistry(path = CUSTOM_SOURCE_REGISTRY_PATH) {
  try {
    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw.replace(/^\uFEFF/, "")) as { records?: unknown };
    return Array.isArray(parsed.records)
      ? parsed.records.filter(isSourceRegistryRecord)
      : [];
  } catch {
    return [];
  }
}

export async function appendSourceRegistryRecord(
  input: SourceRegistryInput,
  path = CUSTOM_SOURCE_REGISTRY_PATH,
) {
  const current = await readCustomSourceRegistry(path);
  const record = normalizeSourceRegistryInput(input);
  const next = [
    record,
    ...current.filter((item) => item.id !== record.id && item.name !== record.name),
  ].slice(0, 200);

  await mkdir(dirname(path), { recursive: true });
  await writeFile(
    path,
    `${JSON.stringify(
      {
        updatedAt: new Date().toISOString(),
        records: next,
      },
      null,
      2,
    )}\n`,
  );

  return next;
}

export function summarizeSourceRegistry(records: SourceRegistryRecord[]) {
  return {
    records: records.length,
    official: records.filter((record) => record.credibility === "Official").length,
    active: records.filter((record) => record.status === "Active").length,
    needsCuration: records.filter((record) => record.status === "Needs curation").length,
    averageWeight:
      records.reduce((sum, record) => sum + record.weight, 0) / Math.max(1, records.length),
  };
}

export function normalizeSourceRegistryInput(input: SourceRegistryInput): SourceRegistryRecord {
  const domains = input.domains.map(normalizeRegistryDomain).filter(Boolean);
  const id =
    input.id?.trim() ||
    `${input.type}-${input.name}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  const credibility = input.credibility;
  const weight =
    typeof input.weight === "number" && Number.isFinite(input.weight)
      ? clamp(input.weight, 0.05, 0.98)
      : readWeightForCredibility(credibility);

  return {
    id,
    name: input.name.trim(),
    type: input.type,
    coverage: input.coverage.trim(),
    credibility,
    role: input.role.trim(),
    domains,
    weight,
    status: input.status,
    notes: input.notes.trim(),
  };
}

function mapRuleToRecord(rule: (typeof sourceCredibilityRules)[number], index: number) {
  const type = readType(rule.tier, rule.label);

  return {
    id: `credibility-rule-${index + 1}`,
    name: rule.label,
    type,
    coverage: readCoverage(rule.label),
    credibility: rule.tier,
    role: rule.role,
    domains: rule.domains,
    weight: readWeight(rule.tier),
    status: "Active" as const,
    notes: `${rule.domains.length} domains mapped for automatic credibility scoring.`,
  };
}

function readType(tier: CredibilityTier, label: string): SourceRegistryRecord["type"] {
  if (tier === "Official") return "Official data";
  if (label.toLowerCase().includes("newswire")) return "Newswire";
  if (label.toLowerCase().includes("turkey")) return "Local press";
  return "Local press";
}

function readCoverage(label: string) {
  const lowered = label.toLowerCase();
  if (lowered.includes("official")) return "Macro releases, regulation, policy";
  if (lowered.includes("newswire")) return "Global macro and institutional news";
  if (lowered.includes("financial")) return "Turkey macro, FX, rates, market commentary";
  return "Local event context and narrative monitoring";
}

function readWeight(tier: CredibilityTier) {
  if (tier === "Official") return 0.95;
  if (tier === "High") return 0.78;
  if (tier === "Medium") return 0.56;
  return 0.28;
}

function readWeightForCredibility(credibility: SourceRegistryRecord["credibility"]) {
  if (credibility === "Machine-readable") return 0.82;
  if (credibility === "Weighted") return 0.42;
  return readWeight(credibility);
}

function normalizeRegistryDomain(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function dedupeSourceRegistry(records: SourceRegistryRecord[]) {
  const byId = new Map<string, SourceRegistryRecord>();
  for (const record of records) {
    byId.set(record.id, record);
  }
  return Array.from(byId.values());
}

function isSourceRegistryRecord(value: unknown): value is SourceRegistryRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;

  return (
    typeof record.id === "string" &&
    typeof record.name === "string" &&
    typeof record.type === "string" &&
    Array.isArray(record.domains) &&
    typeof record.weight === "number" &&
    typeof record.status === "string"
  );
}

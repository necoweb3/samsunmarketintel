import { scoreDomainCredibility } from "@/src/product/sourceCredibility";
import type { SourceRegistryRecord } from "@/src/product/sourceRegistry";

export type ResearchSource = {
  title: string;
  url: string;
  domain: string;
  content: string;
  score: number | null;
  credibility: "Official" | "High" | "Medium" | "Watch";
  registrySource: string | null;
  registryRole: string | null;
};

export type ResearchSnapshot = {
  query: string;
  answer: string | null;
  sourceCount: number;
  officialSources: number;
  averageScore: number | null;
  topSources: ResearchSource[];
  payment: {
    amount: string | null;
    chain: string | null;
    scheme: string | null;
    seller: string | null;
  } | null;
};

type JsonObject = Record<string, unknown>;
type ResearchCredibility = ResearchSource["credibility"];

export type ResearchSnapshotOptions = {
  sourceRegistry?: SourceRegistryRecord[];
};

export function buildResearchSnapshot(
  payload: unknown,
  options: ResearchSnapshotOptions = {},
): ResearchSnapshot {
  const response = readResponse(payload);
  const rawResults = extractResults(response);
  const topSources = rawResults
    .map((source) => normalizeSource(source, options.sourceRegistry))
    .filter((source): source is ResearchSource => source !== null)
    .slice(0, 8);
  const scored = topSources
    .map((source) => source.score)
    .filter((score): score is number => score !== null);

  return {
    query: stringify(getPath(response, ["query"])) ?? "Turkey macro research",
    answer: readAnswer(response),
    sourceCount: topSources.length,
    officialSources: topSources.filter((source) => source.credibility === "Official").length,
    averageScore:
      scored.length > 0
        ? scored.reduce((sum, score) => sum + score, 0) / scored.length
        : null,
    topSources,
    payment: extractPayment(payload),
  };
}

function readResponse(payload: unknown) {
  return (
    getPath(payload, ["data", "response"]) ??
    getPath(payload, ["response"]) ??
    getPath(payload, ["data"]) ??
    payload
  );
}

function extractResults(response: unknown): unknown[] {
  const candidates = [
    getPath(response, ["results"]),
    getPath(response, ["search_results"]),
    getPath(response, ["data", "results"]),
  ];

  return candidates.find(Array.isArray) ?? [];
}

function normalizeSource(
  value: unknown,
  sourceRegistry: SourceRegistryRecord[] = [],
): ResearchSource | null {
  if (!isObject(value)) return null;

  const url = stringify(firstPresent(value, ["url", "link"])) ?? "";
  const title = stringify(firstPresent(value, ["title", "name"])) ?? url;
  const content = stringify(firstPresent(value, ["content", "snippet", "excerpt"])) ?? "";
  if (!url && !title) return null;

  const domain = readDomain(url);
  const registryMatch = findRegistryMatch(domain, sourceRegistry);
  return {
    title,
    url,
    domain,
    content,
    score: toNumber(firstPresent(value, ["score", "relevance_score"])),
    credibility: registryMatch?.credibility ?? scoreDomainCredibility(domain),
    registrySource: registryMatch?.record.name ?? null,
    registryRole: registryMatch?.record.role ?? null,
  };
}

function findRegistryMatch(domain: string, sourceRegistry: SourceRegistryRecord[]) {
  const normalized = normalizeDomain(domain);
  if (!normalized || sourceRegistry.length === 0) return null;

  const matches = sourceRegistry
    .filter((record) =>
      record.domains.some((candidate) => domainMatches(normalized, candidate)),
    )
    .map((record) => ({
      record,
      credibility: mapRegistryCredibility(record),
    }))
    .sort(
      (left, right) =>
        rankCredibility(right.credibility) - rankCredibility(left.credibility) ||
        right.record.weight - left.record.weight,
    );

  return matches[0] ?? null;
}

function mapRegistryCredibility(record: SourceRegistryRecord): ResearchCredibility {
  const direct =
    record.credibility === "Machine-readable"
      ? "High"
      : record.credibility === "Weighted"
        ? record.weight >= 0.5 && record.status === "Active"
          ? "Medium"
          : "Watch"
        : record.credibility;

  if (record.status === "Watch") return "Watch";
  if (record.status === "Needs curation" && rankCredibility(direct) > rankCredibility("Medium")) {
    return "Medium";
  }

  return direct;
}

function rankCredibility(credibility: ResearchCredibility) {
  return {
    Watch: 1,
    Medium: 2,
    High: 3,
    Official: 4,
  }[credibility];
}

function domainMatches(domain: string, candidate: string) {
  const normalizedCandidate = normalizeDomain(candidate);
  return (
    normalizedCandidate.length > 0 &&
    (domain === normalizedCandidate || domain.endsWith(`.${normalizedCandidate}`))
  );
}

function normalizeDomain(domain: string) {
  return domain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
}

function readAnswer(response: unknown) {
  if (!isObject(response)) return null;

  const direct = stringify(firstPresent(response, ["answer", "content"]));
  if (direct) return direct;

  const choices = response.choices;
  if (Array.isArray(choices)) {
    const first = choices[0];
    const content = getPath(first, ["message", "content"]);
    return stringify(content);
  }

  return null;
}

function extractPayment(payload: unknown) {
  const payment = getPath(payload, ["data", "payment"]) ?? getPath(payload, ["payment"]);
  if (!isObject(payment)) return null;

  return {
    amount: stringify(firstPresent(payment, ["amount", "price", "maxAmount"])),
    chain: stringify(firstPresent(payment, ["chain", "network"])),
    scheme: stringify(firstPresent(payment, ["scheme", "paymentScheme"])),
    seller: stringify(firstPresent(payment, ["seller", "payTo", "recipient"])),
  };
}

function readDomain(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function getPath(value: unknown, path: string[]): unknown {
  return path.reduce<unknown>((current, key) => {
    if (!isObject(current)) return undefined;
    return current[key];
  }, value);
}

function firstPresent(value: JsonObject, keys: string[]) {
  for (const key of keys) {
    const current = value[key];
    if (current !== undefined && current !== null && current !== "") {
      return current;
    }
  }
  return null;
}

function stringify(value: unknown) {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "bigint" || typeof value === "boolean") {
    return String(value);
  }
  return null;
}

function toNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replaceAll(",", ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

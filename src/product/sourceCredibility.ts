export type CredibilityTier = "Official" | "High" | "Medium" | "Watch";

export type SourceRule = {
  label: string;
  domains: string[];
  tier: CredibilityTier;
  role: string;
};

export const sourceCredibilityRules: SourceRule[] = [
  {
    label: "Turkey official macro data",
    tier: "Official",
    role: "Resolution-grade macro source",
    domains: [
      "tuik.gov.tr",
      "tcmb.gov.tr",
      "hmb.gov.tr",
      "resmigazete.gov.tr",
      "bddk.org.tr",
      "spk.gov.tr",
    ],
  },
  {
    label: "Global market newswires",
    tier: "High",
    role: "Institutional news verification",
    domains: ["reuters.com", "bloomberg.com", "ft.com", "wsj.com", "apnews.com"],
  },
  {
    label: "Turkey financial press",
    tier: "High",
    role: "Local macro and markets context",
    domains: ["bloomberght.com", "aa.com.tr", "foreks.com", "ekonomim.com"],
  },
  {
    label: "Local news context",
    tier: "Medium",
    role: "Narrative and event monitoring",
    domains: ["dailysabah.com", "hurriyetdailynews.com", "trthaber.com"],
  },
];

export function scoreDomainCredibility(domain: string): CredibilityTier {
  const normalized = normalizeDomain(domain);
  if (!normalized) return "Watch";

  const match = sourceCredibilityRules.find((rule) =>
    rule.domains.some((candidate) => domainMatches(normalized, candidate)),
  );

  return match?.tier ?? "Medium";
}

export function describeDomainRole(domain: string) {
  const normalized = normalizeDomain(domain);
  const match = sourceCredibilityRules.find((rule) =>
    rule.domains.some((candidate) => domainMatches(normalized, candidate)),
  );

  return match?.role ?? "Unregistered source";
}

function normalizeDomain(domain: string) {
  return domain.toLowerCase().replace(/^www\./, "");
}

function domainMatches(domain: string, candidate: string) {
  const normalizedCandidate = normalizeDomain(candidate);
  return domain === normalizedCandidate || domain.endsWith(`.${normalizedCandidate}`);
}

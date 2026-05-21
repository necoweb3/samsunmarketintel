import type { SourceRegistryInput } from "@/src/product/sourceRegistry";
import { turkeyCuratedSources } from "@/src/product/turkeyCuratedSources";

export const turkeyStarterSources: SourceRegistryInput[] = [
  {
    id: "starter-turkey-official-macro",
    name: "Turkey official macro starter pack",
    type: "Official data",
    coverage: "CPI, rates, regulation, treasury, banking, capital markets",
    credibility: "Official",
    role: "Resolution-grade source set for Turkey macro markets",
    domains: [
      "tuik.gov.tr",
      "tcmb.gov.tr",
      "hmb.gov.tr",
      "resmigazete.gov.tr",
      "bddk.org.tr",
      "spk.gov.tr",
    ],
    status: "Active",
    notes:
      "Safe starter pack from official Turkey macro/regulatory domains. Add user-curated accounts separately.",
  },
  {
    id: "starter-turkey-financial-press",
    name: "Turkey financial press starter pack",
    type: "Local press",
    coverage: "Turkey macro, FX, rates, policy commentary, institutional news context",
    credibility: "High",
    role: "Local context layer before official confirmation",
    domains: ["bloomberght.com", "aa.com.tr", "foreks.com", "ekonomim.com"],
    status: "Active",
    notes:
      "Starter local financial press pack. Treat as context; official releases remain resolution sources.",
  },
  {
    id: "starter-market-integrity-inputs",
    name: "Market integrity starter inputs",
    type: "Community report",
    coverage: "Suspicious-flow reports, official match pages, community integrity leads",
    credibility: "Weighted",
    role: "Watchlist input for suspicious pre-event market movement",
    domains: ["official match pages", "community reports"],
    status: "Watch",
    notes:
      "Used only for alerts until corroborated by paid trade-flow data or official operator/match sources.",
  },
  ...turkeyCuratedSources,
];

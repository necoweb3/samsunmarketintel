import assert from "node:assert/strict";

import { buildResearchSnapshot } from "../src/product/researchAnalysis.js";
import type { SourceRegistryRecord } from "../src/product/sourceRegistry.js";

const sourceRegistry: SourceRegistryRecord[] = [
  {
    id: "test-official-tuik",
    name: "Turkey official macro data",
    type: "Official data",
    coverage: "Turkey CPI and macro releases",
    credibility: "Official",
    role: "Resolution-grade macro source",
    domains: ["tuik.gov.tr"],
    weight: 0.95,
    status: "Active",
    notes: "Synthetic check fixture.",
  },
  {
    id: "test-circle-x402",
    name: "Circle x402 market APIs",
    type: "Paid data",
    coverage: "Paid market data services",
    credibility: "Machine-readable",
    role: "Market data and flow integrity",
    domains: ["agents.circle.com"],
    weight: 0.82,
    status: "Active",
    notes: "Synthetic check fixture.",
  },
  {
    id: "test-x-watchlist",
    name: "Macro X watchlist",
    type: "X account",
    coverage: "Turkey macro social flow",
    credibility: "Weighted",
    role: "Early signal before official confirmation",
    domains: ["x.com"],
    weight: 0.42,
    status: "Needs curation",
    notes: "Synthetic check fixture.",
  },
];

const snapshot = buildResearchSnapshot(
  {
    response: {
      query: "Turkey CPI research",
      results: [
        {
          title: "Official CPI release",
          url: "https://data.tuik.gov.tr/Bulten/Index",
          content: "Official CPI release fixture.",
          score: 0.95,
        },
        {
          title: "Paid service directory",
          url: "https://agents.circle.com/services",
          content: "Circle x402 service fixture.",
          score: 0.9,
        },
        {
          title: "Uncurated macro signal",
          url: "https://x.com/example/status/123",
          content: "Social signal fixture.",
          score: 0.7,
        },
      ],
    },
  },
  { sourceRegistry },
);

const byDomain = new Map(snapshot.topSources.map((source) => [source.domain, source]));

assert.equal(byDomain.get("data.tuik.gov.tr")?.credibility, "Official");
assert.equal(byDomain.get("agents.circle.com")?.credibility, "High");
assert.equal(byDomain.get("x.com")?.credibility, "Watch");
assert.equal(byDomain.get("x.com")?.registrySource, "Macro X watchlist");

console.log(
  JSON.stringify(
    {
      status: "ok",
      checked: snapshot.topSources.map((source) => ({
        domain: source.domain,
        credibility: source.credibility,
        registrySource: source.registrySource,
      })),
    },
    null,
    2,
  ),
);

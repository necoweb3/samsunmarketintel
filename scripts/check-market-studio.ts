import assert from "node:assert/strict";

import {
  appendMarketStudioSpec,
  attachMarketStudioSourceCoverage,
  readMarketStudioSpecs,
  summarizeMarketStudio,
} from "../src/product/marketStudio.js";
import { buildSourceRegistry } from "../src/product/sourceRegistry.js";

const testPath = ".cache/test/market-studio-check.json";

await appendMarketStudioSpec(
  {
    title: "Turkey Food CPI Test",
    vertical: "Turkey Macro",
    status: "Needs source list",
    marketQuestion: "Will Turkey food CPI exceed consensus in the next release?",
    problem: "Turkey-specific macro events are under-served by prediction market venues.",
    demand: "Macro traders, local analysts, importers, and rates watchers.",
    settlementCurrency: "USDC",
    settlementRail: "Arc receipt + Circle x402",
    oracle: {
      method: "Pre-declared source check with manual review before public launch.",
      primarySource: "tuik.gov.tr",
      fallbackSource: "tcmb.gov.tr",
      resolutionWindow: "Same day as official release",
    },
    primarySources: ["tuik.gov.tr", "tcmb.gov.tr"],
    liquidityPlan: "Seed only around scheduled event windows.",
    riskPolicy: "Manual approval only; block execution if official confirmation is missing.",
  },
  testPath,
);

const specs = await readMarketStudioSpecs(testPath);
const coveredSpecs = attachMarketStudioSourceCoverage(specs, buildSourceRegistry());
const summary = summarizeMarketStudio(coveredSpecs);
const custom = coveredSpecs.find((spec) => spec.id === "turkey-macro-turkey-food-cpi-test");

assert.ok(custom);
assert.equal(custom.launchReadiness, 0.54);
assert.equal(custom.sourceCoverage?.status, "ready");
assert.equal(custom.sourceCoverage?.matched, 2);
assert.ok(summary.specs >= 4);
assert.ok(summary.sourceReady >= 1);

console.log(
  JSON.stringify(
    {
      status: "ok",
      custom: {
        id: custom.id,
        title: custom.title,
        launchReadiness: custom.launchReadiness,
        sourceCoverage: custom.sourceCoverage,
      },
      summary,
    },
    null,
    2,
  ),
);

import "dotenv/config";

import { buildProductReadiness } from "../src/product/productReadiness.js";

const report = await buildProductReadiness();

console.log(
  JSON.stringify(
    {
      status: report.status,
      summary: report.summary,
      apiBinding: report.apiBinding,
      checks: report.checks.map((check) => ({
        id: check.id,
        status: check.status,
        detail: check.detail,
        nextAction: check.nextAction,
      })),
      blockers: report.blockers,
    },
    null,
    2,
  ),
);

if (process.argv.includes("--strict") && !report.apiBinding.ready) {
  process.exitCode = 1;
}

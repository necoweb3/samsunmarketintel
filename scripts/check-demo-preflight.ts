import "dotenv/config";

import { buildDemoPreflight } from "../src/product/demoPreflight.js";

const report = await buildDemoPreflight();

console.log(JSON.stringify(report, null, 2));

if (process.argv.includes("--strict") && report.status === "blocked") {
  process.exitCode = 1;
}

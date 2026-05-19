import { buildToolSafetyReport } from "../src/product/toolSafety.js";

const report = buildToolSafetyReport();

console.log(
  JSON.stringify(
    {
      status: report.status,
      summary: report.summary,
      failed: report.scenarios
        .filter((scenario) => !scenario.passed)
        .map((scenario) => ({
          id: scenario.id,
          expected: scenario.expected,
          actual: scenario.actual,
          reason: scenario.decision.reason,
        })),
      scenarios: report.scenarios.map((scenario) => ({
        id: scenario.id,
        expected: scenario.expected,
        actual: scenario.actual,
        passed: scenario.passed,
      })),
    },
    null,
    2,
  ),
);

if (report.status !== "pass") {
  process.exitCode = 1;
}

import "dotenv/config";

import { buildSentientPipelineStatus } from "../src/product/sentientActivation.js";

const status = buildSentientPipelineStatus();

console.log(
  JSON.stringify(
    {
      status: status.status,
      activeComponents: status.activeComponents,
      waitingComponents: status.waitingComponents,
      components: {
        safeFunctionCalling: {
          status: status.components.safeFunctionCalling.status,
          scenariosPassed: status.components.safeFunctionCalling.scenariosPassed,
          scenariosTotal: status.components.safeFunctionCalling.scenariosTotal,
        },
        openDeepSearch: {
          status: status.components.openDeepSearch.status,
          mode: status.components.openDeepSearch.mode,
          searchProvider: status.components.openDeepSearch.searchProvider,
          reranker: status.components.openDeepSearch.reranker,
          missing: status.components.openDeepSearch.missing,
          currentInput: status.components.openDeepSearch.currentInput,
        },
        roma: {
          status: status.components.roma.status,
          lanes: status.components.roma.lanes,
        },
        cryptoAnalystBench: status.components.cryptoAnalystBench.status,
      },
      routes: status.routes,
      notes: status.notes,
    },
    null,
    2,
  ),
);

if (status.components.safeFunctionCalling.status !== "active") {
  process.exitCode = 1;
}

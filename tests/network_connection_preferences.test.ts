import assert from "node:assert/strict";
import test from "node:test";

import networkConfigModule from "../frontend/lib/network-config.ts";

const {
  buildRpcEnvironment,
  hydrateConnectionPreferences,
  resolveRpcEndpoint,
  validateCustomRpcUrl,
} = networkConfigModule as typeof import("../frontend/lib/network-config.ts");

test("connection preferences default to public RPC profiles and the explorer cluster", () => {
  const environment = buildRpcEnvironment({
    NEXT_PUBLIC_SOLANA_EXPLORER_CLUSTER: "mainnet-beta",
  });

  const hydrated = hydrateConnectionPreferences({
    explorerCluster: "mainnet-beta",
    environment,
  });

  assert.equal(hydrated.selectedNetwork, "mainnet-beta");
  assert.deepEqual(hydrated.rpcProfiles, {
    devnet: "public",
    "mainnet-beta": "public",
  });
  assert.deepEqual(hydrated.customRpcEndpoints, {
    devnet: "",
    "mainnet-beta": "",
  });
});

test("configured Helius endpoints are selectable per cluster", () => {
  const environment = buildRpcEnvironment({
    NEXT_PUBLIC_SOLANA_DEVNET_RPC_URL_WITH_KEY: "https://devnet.helius-rpc.com/?api-key=test",
    NEXT_PUBLIC_SOLANA_MAINNET_RPC_URL_WITH_KEY: "https://mainnet.helius-rpc.com/?api-key=test",
  });

  const resolvedDevnet = resolveRpcEndpoint("devnet", "helius", environment, {
    devnet: "",
    "mainnet-beta": "",
  });
  const resolvedMainnet = resolveRpcEndpoint("mainnet-beta", "helius", environment, {
    devnet: "",
    "mainnet-beta": "",
  });

  assert.equal(resolvedDevnet.rpcProfile, "helius");
  assert.equal(resolvedDevnet.endpoint, "https://devnet.helius-rpc.com/?api-key=test");
  assert.equal(resolvedMainnet.rpcProfile, "helius");
  assert.equal(resolvedMainnet.endpoint, "https://mainnet.helius-rpc.com/?api-key=test");
});

test("stored Helius profiles fall back to public when the cluster is not configured", () => {
  const environment = buildRpcEnvironment({});

  const hydrated = hydrateConnectionPreferences({
    explorerCluster: "devnet",
    storedRpcProfiles: JSON.stringify({
      devnet: "helius",
      "mainnet-beta": "helius",
    }),
    environment,
  });

  assert.deepEqual(hydrated.rpcProfiles, {
    devnet: "public",
    "mainnet-beta": "public",
  });
});

test("custom RPC endpoints persist independently per cluster", () => {
  const environment = buildRpcEnvironment({});

  const hydrated = hydrateConnectionPreferences({
    explorerCluster: "devnet",
    storedRpcProfiles: JSON.stringify({
      devnet: "custom",
      "mainnet-beta": "public",
    }),
    storedCustomRpcEndpoints: JSON.stringify({
      devnet: "https://devnet.rpc.example.com",
      "mainnet-beta": "https://mainnet.rpc.example.com",
    }),
    environment,
  });

  assert.equal(hydrated.rpcProfiles.devnet, "custom");
  assert.equal(hydrated.rpcProfiles["mainnet-beta"], "public");
  assert.equal(hydrated.customRpcEndpoints.devnet, "https://devnet.rpc.example.com");
  assert.equal(hydrated.customRpcEndpoints["mainnet-beta"], "https://mainnet.rpc.example.com");

  const resolvedDevnet = resolveRpcEndpoint("devnet", hydrated.rpcProfiles.devnet, environment, hydrated.customRpcEndpoints);
  const resolvedMainnet = resolveRpcEndpoint("mainnet-beta", hydrated.rpcProfiles["mainnet-beta"], environment, hydrated.customRpcEndpoints);

  assert.equal(resolvedDevnet.rpcProfile, "custom");
  assert.equal(resolvedDevnet.endpoint, "https://devnet.rpc.example.com");
  assert.equal(resolvedMainnet.rpcProfile, "public");
  assert.equal(resolvedMainnet.endpoint, "https://api.mainnet-beta.solana.com");
});

test("custom RPC validation accepts http/https endpoints only", () => {
  assert.equal(validateCustomRpcUrl("https://rpc.example.com"), null);
  assert.match(validateCustomRpcUrl(""), /http:\/\/ or https:\/\//);
  assert.match(validateCustomRpcUrl("wss://rpc.example.com"), /http:\/\/ or https:\/\//);
  assert.match(validateCustomRpcUrl("not-a-url"), /http:\/\/ or https:\/\//);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs/promises';
import path from 'node:path';
import { PolicyEngine } from '../core/runtime/policy/index.ts';
import { DiagnosticsChannel } from '../core/runtime/observability/index.ts';
import { PluginRuntime } from '../core/runtime/plugin-runtime/lifecycle-runner.ts';
import { RuntimeContracts } from '../src/core/plugins/runtime-contracts.js';

class TestLogger {
  info() {}
  warn() {}
  error() {}
}

const writePlugin = async (root, name, manifestBody, registerBody = 'export default () => () => {};') => {
  const dir = path.join(root, name);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'manifest.ts'), manifestBody);
  await fs.writeFile(path.join(dir, 'register.ts'), registerBody);
};

test('phase 26: policy engine decisions are deterministic for identical inputs', () => {
  const diagnosticsChannel = new DiagnosticsChannel();
  const policyEngine = new PolicyEngine({ diagnosticsChannel });

  const input = {
    pluginId: 'alpha',
    capability: 'content',
    stage: 'register',
    topologySnapshot: Object.freeze({ nodes: Object.freeze([{ id: 'alpha' }]), edges: Object.freeze([]) }),
    healthSnapshot: Object.freeze({
      plugins: Object.freeze([{ pluginId: 'alpha', status: 'healthy' }]),
      failures: Object.freeze([]),
      recoveryActions: Object.freeze([]),
      degradedCapabilities: Object.freeze([])
    }),
    routingDecision: Object.freeze({
      required: true,
      providerId: 'alpha',
      policy: 'single',
      candidates: Object.freeze(['alpha'])
    }),
    versionResolution: Object.freeze({
      resolvedVersions: Object.freeze([]),
      compatibilityWarnings: Object.freeze([]),
      rejectedPlugins: Object.freeze([])
    })
  };

  const first = policyEngine.evaluate(input);
  const second = policyEngine.evaluate(input);

  assert.deepEqual(first, second);
  assert.equal(first.allowExecution, true);
});

test('phase 26: policy activates degraded mode and selects exponential retry strategy', () => {
  const policyEngine = new PolicyEngine();

  const decision = policyEngine.evaluate({
    pluginId: 'degraded-plugin',
    capability: 'media:render',
    stage: 'register',
    healthSnapshot: Object.freeze({
      plugins: Object.freeze([{ pluginId: 'degraded-plugin', status: 'degraded' }]),
      failures: Object.freeze([{ pluginId: 'degraded-plugin' }]),
      recoveryActions: Object.freeze([]),
      degradedCapabilities: Object.freeze(['media:render'])
    }),
    routingDecision: Object.freeze({
      required: true,
      providerId: 'degraded-plugin',
      policy: 'single',
      candidates: Object.freeze(['degraded-plugin'])
    })
  });

  assert.equal(decision.allowExecution, true);
  assert.equal(decision.degradedMode, true);
  assert.equal(decision.retryStrategy, 'exponential-backoff');
});

test('phase 26: policy blocks execution when routing is required but unresolved', () => {
  const policyEngine = new PolicyEngine();

  const decision = policyEngine.evaluate({
    pluginId: 'blocked-plugin',
    stage: 'register',
    routingDecision: Object.freeze({
      required: true,
      providerId: null,
      policy: 'fallback',
      candidates: Object.freeze([])
    })
  });

  assert.equal(decision.allowExecution, false);
  assert.equal(decision.retryStrategy, 'none');
  assert.deepEqual(decision.reasons, ['routing-provider-unavailable']);
});

test('phase 26: runtime inspector exposes policy evaluations and diagnostics events', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nimb-policy-runtime-'));
  const logger = new TestLogger();

  await writePlugin(root, 'alpha', `
export const pluginManifest = {
  id: 'alpha',
  version: '1.0.0',
  entrypoints: { register: './register.ts' },
  declaredCapabilities: [],
  requiredPlatformContracts: { 'plugin.runtime': '^1.0.0' }
};
`);

  const runtimeContracts = new RuntimeContracts({ logger });
  const runtime = new PluginRuntime({
    pluginsDirectory: root,
    contracts: runtimeContracts.createContractSurface(),
    logger
  });

  await runtime.start();

  const policySnapshot = runtime.getInspector().policy();
  assert.equal(policySnapshot.evaluations.length >= 1, true);
  assert.equal(policySnapshot.evaluations.some((entry) => entry.pluginId === 'alpha' && entry.allowExecution === true), true);

  const diagnostics = runtime.getInspector().snapshot().diagnostics;
  assert.equal(diagnostics.some((entry) => entry.type === 'policy:evaluated' && entry.payload.pluginId === 'alpha'), true);
});

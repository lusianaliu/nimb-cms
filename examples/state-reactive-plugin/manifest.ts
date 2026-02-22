let getSummaryRef = () => ({ createdCount: 0, latestTitle: null });
let subscribeRef = (_handler: (value: unknown) => void | Promise<void>) => () => {};

export const pluginManifest = {
  id: '@nimblabs/plugin-state-reactive-example',
  version: '0.1.0',
  displayName: 'Nimb State Reactive Plugin Example',
  entrypoints: {
    register: './register.ts'
  },
  declaredCapabilities: [],
  exportedEvents: [],
  exportedCapabilities: {
    'state-reactive:content-summary': () => ({
      getSummary: () => getSummaryRef(),
      subscribe: (handler) => subscribeRef(handler)
    })
  },
  requiredPlatformContracts: {
    'plugin.on': '^1.0.0',
    'plugin.state.define': '^1.0.0',
    'plugin.state.update': '^1.0.0',
    'plugin.state.get': '^1.0.0',
    'plugin.state.subscribe': '^1.0.0'
  }
} as const;

export const bindSummaryCapability = (getSummary, subscribe) => {
  getSummaryRef = getSummary;
  subscribeRef = subscribe;
};

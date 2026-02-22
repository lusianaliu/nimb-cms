export const pluginManifest = {
  id: '@nimblabs/plugin-state-observer-example',
  version: '0.1.0',
  displayName: 'Nimb State Observer Plugin Example',
  entrypoints: {
    register: './register.ts'
  },
  declaredCapabilities: [],
  consumedCapabilities: ['state-reactive:content-summary'],
  requiredPlatformContracts: {
    'plugin.useCapability': '^1.0.0'
  }
} as const;

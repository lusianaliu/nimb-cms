export const pluginManifest = {
  id: '@nimblabs/plugin-event-reactive-example',
  version: '0.1.0',
  displayName: 'Nimb Event Reactive Plugin Example',
  entrypoints: {
    register: './register.ts'
  },
  declaredCapabilities: [],
  consumedCapabilities: ['content:create'],
  exportedEvents: ['content:created'],
  requiredPlatformContracts: {
    'plugin.useCapability': '^1.0.0',
    'plugin.on': '^1.0.0',
    'plugin.emit': '^1.0.0'
  }
} as const;

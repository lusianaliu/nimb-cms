export const pluginManifest = {
  id: '@nimblabs/plugin-composed-example',
  version: '0.1.0',
  displayName: 'Nimb Composed Plugin Example',
  entrypoints: {
    register: './register.ts'
  },
  declaredCapabilities: ['content:create'],
  requiredPlatformContracts: {
    'plugin.registerCapability': '^1.0.0',
    'plugin.unregisterCapability': '^1.0.0',
    'plugin.registerSchema': '^1.0.0',
    'plugin.unregisterSchema': '^1.0.0',
    'plugin.registerLifecycleHook': '^1.0.0',
    'plugin.useCapability': '^1.0.0'
  }
} as const;

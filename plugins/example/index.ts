import type { NimbPlugin } from '../../core/plugins/plugin.ts';

const examplePlugin: NimbPlugin = {
  name: 'example',
  setup(context) {
    context.hooks.register('content.create.transform', async (value: Record<string, unknown>) => ({
      ...value,
      pluginTouched: true
    }));
  }
};

export default examplePlugin;

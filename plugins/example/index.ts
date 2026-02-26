import type { NimbPlugin } from '../../core/plugins/plugin.ts';

const examplePlugin: NimbPlugin = {
  name: 'example',
  setup(runtime) {
    runtime.hooks.on('content.created', () => {
      console.log('Example plugin received event');
    });
  }
};

export default examplePlugin;

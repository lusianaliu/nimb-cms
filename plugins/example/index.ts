import type { NimbPlugin } from '../../core/plugins/plugin.ts';

const examplePlugin: NimbPlugin = {
  name: 'example',
  setup(context) {
    context.hooks.on('content.created', () => {
      console.log('Example plugin received event');
    });
  }
};

export default examplePlugin;

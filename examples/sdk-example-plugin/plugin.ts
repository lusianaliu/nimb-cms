import { definePlugin } from '../../packages/plugin-sdk/index.ts';

export default definePlugin({
  name: 'sdk-example-plugin',
  version: '1.0.0',
  capabilities: [
    {
      key: 'example:read',
      version: '1.0.0',
      description: 'Read capability declared through the author SDK.'
    }
  ],
  schemas: [
    {
      id: 'example.article',
      version: '1.0.0',
      type: 'object',
      required: ['title'],
      additionalProperties: false,
      properties: {
        title: {
          type: 'string'
        }
      }
    }
  ],
  lifecycle: {
    hooks: [
      {
        name: 'onExampleEvent',
        order: 10,
        handler: async (_event, context) => {
          context.logger.info('sdk-example runtime hook registered', {
            plugin: context.pluginId
          });
        }
      }
    ],
    onStart: async (context) => {
      context.logger.info('sdk-example started', {
        plugin: context.pluginId,
        version: context.pluginVersion
      });
    },
    onStop: async (context) => {
      context.logger.info('sdk-example stopped', {
        plugin: context.pluginId
      });
    }
  }
});

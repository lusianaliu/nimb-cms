import { BlockRegistry } from './block-registry.js';

const headingBlock = {
  type: 'heading',
  schema: {
    type: 'object',
    required: ['level', 'text'],
    additionalProperties: false,
    properties: {
      level: { type: 'enum', values: [1, 2, 3, 4, 5, 6] },
      text: { type: 'string', minLength: 1 }
    }
  }
};

const paragraphBlock = {
  type: 'paragraph',
  schema: {
    type: 'object',
    required: ['text'],
    additionalProperties: false,
    properties: {
      text: { type: 'string', minLength: 1 }
    }
  }
};

const imageBlock = {
  type: 'image',
  schema: {
    type: 'object',
    required: ['src'],
    additionalProperties: false,
    properties: {
      src: { type: 'string', minLength: 1 },
      alt: { type: 'string' },
      caption: { type: 'string' }
    }
  }
};

const listBlock = {
  type: 'list',
  schema: {
    type: 'object',
    required: ['style', 'items'],
    additionalProperties: false,
    properties: {
      style: { type: 'enum', values: ['ordered', 'unordered'] },
      items: {
        type: 'array',
        minItems: 1,
        item: { type: 'string', minLength: 1 }
      }
    }
  }
};

const quoteBlock = {
  type: 'quote',
  schema: {
    type: 'object',
    required: ['text'],
    additionalProperties: false,
    properties: {
      text: { type: 'string', minLength: 1 },
      citation: { type: 'string' }
    }
  }
};

const buttonBlock = {
  type: 'button',
  schema: {
    type: 'object',
    required: ['label', 'url'],
    additionalProperties: false,
    properties: {
      label: { type: 'string', minLength: 1 },
      url: { type: 'string', minLength: 1 }
    }
  }
};

const dividerBlock = {
  type: 'divider',
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {}
  }
};

const BUILT_IN_BLOCKS = [
  headingBlock,
  paragraphBlock,
  imageBlock,
  listBlock,
  quoteBlock,
  buttonBlock,
  dividerBlock
];

export function createDefaultBlockRegistry() {
  const registry = new BlockRegistry();
  BUILT_IN_BLOCKS.forEach((blockDefinition) => registry.register(blockDefinition));
  return registry;
}

export { BUILT_IN_BLOCKS };

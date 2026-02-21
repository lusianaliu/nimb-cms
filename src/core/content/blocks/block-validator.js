import { validateSchemaValue } from './block-schema-validator.js';

export class BlockValidator {
  constructor(options) {
    this.registry = options.registry;
  }

  validateBlock(block, index = null) {
    const prefix = index === null ? 'block' : `body[${index}]`;

    if (!block || typeof block !== 'object' || Array.isArray(block)) {
      return { ok: false, errors: [`${prefix} must be an object`] };
    }

    if (typeof block.type !== 'string' || !block.type) {
      return { ok: false, errors: [`${prefix}.type is required`] };
    }

    const definition = this.registry.get(block.type);
    if (!definition) {
      return { ok: false, errors: [`${prefix}.type is unsupported: ${block.type}`] };
    }

    if (!('data' in block)) {
      return { ok: false, errors: [`${prefix}.data is required`] };
    }

    const errors = validateSchemaValue(block.data, definition.schema, `${prefix}.data`);
    return { ok: errors.length === 0, errors };
  }

  validateBody(body) {
    if (!Array.isArray(body)) {
      return { ok: false, errors: ['body must be an array of blocks'] };
    }

    const errors = [];
    body.forEach((block, index) => {
      const validation = this.validateBlock(block, index);
      if (!validation.ok) {
        errors.push(...validation.errors);
      }
    });

    return { ok: errors.length === 0, errors };
  }
}

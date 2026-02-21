import type { PluginDefinition } from './types.ts';

const assertNonEmptyString = (value: unknown, label: string): void => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`plugin-sdk: "${label}" must be a non-empty string`);
  }
};

const assertFunction = (value: unknown, label: string): void => {
  if (value !== undefined && typeof value !== 'function') {
    throw new Error(`plugin-sdk: "${label}" must be a function`);
  }
};

export const validatePluginDefinition = (definition: PluginDefinition): void => {
  if (!definition || typeof definition !== 'object') {
    throw new Error('plugin-sdk: plugin definition must be an object');
  }

  assertNonEmptyString(definition.name, 'name');
  assertNonEmptyString(definition.version, 'version');

  if (definition.capabilities !== undefined) {
    if (!Array.isArray(definition.capabilities)) {
      throw new Error('plugin-sdk: "capabilities" must be an array');
    }

    for (const [index, capability] of definition.capabilities.entries()) {
      if (!capability || typeof capability !== 'object' || Array.isArray(capability)) {
        throw new Error(`plugin-sdk: capability at index ${index} must be a declarative object`);
      }

      assertNonEmptyString(capability.key, `capabilities[${index}].key`);
      assertNonEmptyString(capability.version, `capabilities[${index}].version`);
      assertNonEmptyString(capability.description, `capabilities[${index}].description`);
    }
  }

  if (definition.schemas !== undefined) {
    if (!Array.isArray(definition.schemas)) {
      throw new Error('plugin-sdk: "schemas" must be an array');
    }

    for (const [index, schema] of definition.schemas.entries()) {
      if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
        throw new Error(`plugin-sdk: schema at index ${index} must be an object`);
      }

      assertNonEmptyString(schema.id, `schemas[${index}].id`);
      assertNonEmptyString(schema.version, `schemas[${index}].version`);
      assertNonEmptyString(schema.type, `schemas[${index}].type`);

      if (!Array.isArray(schema.required)) {
        throw new Error(`plugin-sdk: schemas[${index}].required must be an array`);
      }

      if (typeof schema.additionalProperties !== 'boolean') {
        throw new Error(`plugin-sdk: schemas[${index}].additionalProperties must be boolean`);
      }

      if (!schema.properties || typeof schema.properties !== 'object' || Array.isArray(schema.properties)) {
        throw new Error(`plugin-sdk: schemas[${index}].properties must be an object`);
      }
    }
  }

  if (definition.lifecycle !== undefined) {
    if (!definition.lifecycle || typeof definition.lifecycle !== 'object' || Array.isArray(definition.lifecycle)) {
      throw new Error('plugin-sdk: "lifecycle" must be an object when provided');
    }

    assertFunction(definition.lifecycle.onStart, 'lifecycle.onStart');
    assertFunction(definition.lifecycle.onStop, 'lifecycle.onStop');

    if (definition.lifecycle.hooks !== undefined) {
      if (!Array.isArray(definition.lifecycle.hooks)) {
        throw new Error('plugin-sdk: "lifecycle.hooks" must be an array');
      }

      for (const [index, hook] of definition.lifecycle.hooks.entries()) {
        if (!hook || typeof hook !== 'object' || Array.isArray(hook)) {
          throw new Error(`plugin-sdk: lifecycle hook at index ${index} must be an object`);
        }

        assertNonEmptyString(hook.name, `lifecycle.hooks[${index}].name`);
        assertFunction(hook.handler, `lifecycle.hooks[${index}].handler`);

        if (hook.order !== undefined && (!Number.isInteger(hook.order) || hook.order < 0)) {
          throw new Error(`plugin-sdk: lifecycle.hooks[${index}].order must be a non-negative integer`);
        }
      }
    }
  }
};

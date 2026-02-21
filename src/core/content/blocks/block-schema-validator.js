function getValueType(value) {
  if (Array.isArray(value)) {
    return 'array';
  }

  if (value === null) {
    return 'null';
  }

  return typeof value;
}

function formatPath(path) {
  return path || 'value';
}

export function validateSchemaValue(value, schema, path = '') {
  const errors = [];

  if (!schema || typeof schema !== 'object') {
    errors.push(`${formatPath(path)} has an invalid schema definition`);
    return errors;
  }

  if (schema.type === 'enum') {
    if (!Array.isArray(schema.values) || schema.values.length === 0) {
      errors.push(`${formatPath(path)} enum schema must include values`);
      return errors;
    }

    if (!schema.values.includes(value)) {
      errors.push(`${formatPath(path)} must be one of: ${schema.values.join(', ')}`);
    }

    return errors;
  }

  const actualType = getValueType(value);
  if (actualType !== schema.type) {
    errors.push(`${formatPath(path)} must be of type ${schema.type}`);
    return errors;
  }

  if (schema.type === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push(`${formatPath(path)} must be at least ${schema.minLength} characters`);
    }

    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      errors.push(`${formatPath(path)} must be at most ${schema.maxLength} characters`);
    }

    return errors;
  }

  if (schema.type === 'number') {
    if (Number.isNaN(value)) {
      errors.push(`${formatPath(path)} must be a valid number`);
      return errors;
    }

    if (schema.min !== undefined && value < schema.min) {
      errors.push(`${formatPath(path)} must be greater than or equal to ${schema.min}`);
    }

    if (schema.max !== undefined && value > schema.max) {
      errors.push(`${formatPath(path)} must be less than or equal to ${schema.max}`);
    }

    return errors;
  }

  if (schema.type === 'array') {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      errors.push(`${formatPath(path)} must include at least ${schema.minItems} item(s)`);
    }

    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
      errors.push(`${formatPath(path)} must include at most ${schema.maxItems} item(s)`);
    }

    if (schema.item) {
      value.forEach((item, index) => {
        errors.push(...validateSchemaValue(item, schema.item, `${formatPath(path)}[${index}]`));
      });
    }

    return errors;
  }

  if (schema.type === 'object') {
    const required = schema.required ?? [];
    required.forEach((requiredKey) => {
      if (!(requiredKey in value)) {
        errors.push(`${formatPath(path)}.${requiredKey} is required`);
      }
    });

    const properties = schema.properties ?? {};
    Object.entries(properties).forEach(([key, propertySchema]) => {
      if (value[key] === undefined) {
        return;
      }

      errors.push(...validateSchemaValue(value[key], propertySchema, `${formatPath(path)}.${key}`));
    });

    if (schema.additionalProperties === false) {
      Object.keys(value).forEach((key) => {
        if (!(key in properties)) {
          errors.push(`${formatPath(path)}.${key} is not allowed`);
        }
      });
    }

    return errors;
  }

  return errors;
}

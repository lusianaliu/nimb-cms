const isPlainObject = (value) => {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const deepClone = (value, seen = new WeakMap()) => {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (seen.has(value)) {
    return seen.get(value);
  }

  if (Array.isArray(value)) {
    const output = [];
    seen.set(value, output);
    for (const entry of value) {
      output.push(deepClone(entry, seen));
    }
    return output;
  }

  if (!isPlainObject(value)) {
    return value;
  }

  const output = {};
  seen.set(value, output);
  for (const key of Reflect.ownKeys(value)) {
    output[key] = deepClone(value[key], seen);
  }

  return output;
};

const deepFreeze = (value, seen = new WeakSet()) => {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (seen.has(value)) {
    return value;
  }

  seen.add(value);

  if (Array.isArray(value) || isPlainObject(value)) {
    for (const key of Reflect.ownKeys(value)) {
      deepFreeze(value[key], seen);
    }
  }

  return Object.freeze(value);
};

export class ExecutionBoundary {
  createSandboxContracts(contracts = {}) {
    const clonedContracts = deepClone(contracts);
    deepFreeze(clonedContracts);
    const allowedKeys = new Set(Object.keys(clonedContracts));

    return new Proxy(clonedContracts, {
      get(target, property, receiver) {
        if (typeof property === 'symbol') {
          return Reflect.get(target, property, receiver);
        }

        if (!allowedKeys.has(property)) {
          throw new Error(`sandbox contract access denied: ${String(property)}`);
        }

        return Reflect.get(target, property, receiver);
      },
      set() {
        throw new Error('sandbox contract mutation denied');
      },
      defineProperty() {
        throw new Error('sandbox contract mutation denied');
      },
      deleteProperty() {
        throw new Error('sandbox contract mutation denied');
      }
    });
  }
}

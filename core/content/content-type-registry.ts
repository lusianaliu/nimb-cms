export interface ContentFieldDefinition {
  name: string;
  type: 'string' | 'text' | 'number' | 'boolean' | 'date' | 'datetime' | 'json';
  required?: boolean;
}

export interface ContentTypeDefinition {
  name: string;
  slug: string;
  fields: ContentFieldDefinition[];
}

export class ContentTypeRegistry {
  readonly #definitions: Map<string, ContentTypeDefinition>;

  constructor() {
    this.#definitions = new Map();
  }

  register(definition: ContentTypeDefinition) {
    if (this.#definitions.has(definition.slug)) {
      throw new Error(`Content type already registered for slug: ${definition.slug}`);
    }

    this.#definitions.set(definition.slug, Object.freeze({
      ...definition,
      fields: Object.freeze([...definition.fields])
    }));
  }

  get(slug: string): ContentTypeDefinition | undefined {
    return this.#definitions.get(slug);
  }

  list(): ContentTypeDefinition[] {
    return Object.freeze([...this.#definitions.values()]);
  }
}

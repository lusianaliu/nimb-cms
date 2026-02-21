const VALID_CONTENT_TYPES = new Set(['page', 'post']);
const VALID_CONTENT_STATUSES = new Set(['draft', 'published']);

export class ContentModel {
  constructor({
    id,
    type,
    title,
    slug,
    status,
    body,
    metadata,
    createdAt,
    updatedAt,
    publishedAt,
    revisions
  }) {
    this.id = id;
    this.type = type;
    this.title = title;
    this.slug = slug;
    this.status = status;
    this.body = body;
    this.metadata = metadata;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
    this.publishedAt = publishedAt;
    this.revisions = revisions;
  }

  static isValidType(type) {
    return VALID_CONTENT_TYPES.has(type);
  }

  static isValidStatus(status) {
    return VALID_CONTENT_STATUSES.has(status);
  }
}

export const CONTENT_TYPES = Object.freeze(Array.from(VALID_CONTENT_TYPES));
export const CONTENT_STATUSES = Object.freeze(Array.from(VALID_CONTENT_STATUSES));

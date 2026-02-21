import { randomUUID } from 'node:crypto';
import { ContentModel } from './models/content-model.js';

export class ContentService {
  constructor() {
    this.contents = new Map();
  }

  createContent(input) {
    const type = input?.type;
    const title = input?.title;

    if (!ContentModel.isValidType(type)) {
      return { ok: false, error: 'Unsupported content type' };
    }

    if (!title || typeof title !== 'string') {
      return { ok: false, error: 'Title is required' };
    }

    const metadata = this.normalizeMetadata(input?.metadata);
    if (!metadata) {
      return { ok: false, error: 'Metadata must be a key-value object' };
    }

    const id = randomUUID();
    const slug = this.createUniqueSlug(input?.slug ?? title);
    const now = new Date().toISOString();

    const content = new ContentModel({
      id,
      type,
      title: title.trim(),
      slug,
      status: 'draft',
      metadata,
      createdAt: now,
      updatedAt: now,
      publishedAt: null,
      revisions: []
    });

    this.recordRevision(content, 'created');
    this.contents.set(content.id, content);

    return { ok: true, content: this.serializeContent(content) };
  }

  listContent() {
    return Array.from(this.contents.values()).map((content) => this.serializeContent(content));
  }

  getContentById(id) {
    const content = this.contents.get(id);
    if (!content) {
      return { ok: false, error: 'Content not found' };
    }

    return { ok: true, content: this.serializeContent(content) };
  }

  updateDraft(id, input) {
    const content = this.contents.get(id);
    if (!content) {
      return { ok: false, error: 'Content not found' };
    }

    if (input?.title !== undefined) {
      if (typeof input.title !== 'string' || !input.title.trim()) {
        return { ok: false, error: 'Title must be a non-empty string' };
      }

      content.title = input.title.trim();
    }

    if (input?.slug !== undefined) {
      const normalizedSlug = this.normalizeSlug(input.slug);
      if (!normalizedSlug) {
        return { ok: false, error: 'Slug must contain letters or numbers' };
      }

      content.slug = this.createUniqueSlug(normalizedSlug, content.id);
    }

    if (input?.metadata !== undefined) {
      const metadata = this.normalizeMetadata(input.metadata);
      if (!metadata) {
        return { ok: false, error: 'Metadata must be a key-value object' };
      }

      content.metadata = metadata;
    }

    content.status = 'draft';
    content.updatedAt = new Date().toISOString();
    this.recordRevision(content, 'draft-updated');

    return { ok: true, content: this.serializeContent(content) };
  }

  publishContent(id) {
    const content = this.contents.get(id);
    if (!content) {
      return { ok: false, error: 'Content not found' };
    }

    content.status = 'published';
    content.updatedAt = new Date().toISOString();
    content.publishedAt = content.publishedAt ?? content.updatedAt;

    this.recordRevision(content, 'published');
    return { ok: true, content: this.serializeContent(content) };
  }

  moveToDraft(id) {
    const content = this.contents.get(id);
    if (!content) {
      return { ok: false, error: 'Content not found' };
    }

    content.status = 'draft';
    content.updatedAt = new Date().toISOString();
    this.recordRevision(content, 'moved-to-draft');

    return { ok: true, content: this.serializeContent(content) };
  }

  normalizeMetadata(metadata) {
    if (metadata === undefined) {
      return {};
    }

    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      return null;
    }

    return { ...metadata };
  }

  createUniqueSlug(source, currentContentId = null) {
    const base = this.normalizeSlug(source) ?? `content-${randomUUID().slice(0, 8)}`;
    let candidate = base;
    let suffix = 1;

    while (this.slugExists(candidate, currentContentId)) {
      suffix += 1;
      candidate = `${base}-${suffix}`;
    }

    return candidate;
  }

  normalizeSlug(source) {
    if (typeof source !== 'string') {
      return null;
    }

    const slug = source
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    return slug || null;
  }

  slugExists(slug, currentContentId) {
    for (const content of this.contents.values()) {
      if (content.id === currentContentId) {
        continue;
      }

      if (content.slug === slug) {
        return true;
      }
    }

    return false;
  }

  recordRevision(content, action) {
    const snapshot = {
      id: randomUUID(),
      action,
      timestamp: new Date().toISOString(),
      state: {
        id: content.id,
        type: content.type,
        title: content.title,
        slug: content.slug,
        status: content.status,
        metadata: { ...content.metadata },
        createdAt: content.createdAt,
        updatedAt: content.updatedAt,
        publishedAt: content.publishedAt
      }
    };

    content.revisions.push(snapshot);
  }

  serializeContent(content) {
    return {
      id: content.id,
      type: content.type,
      title: content.title,
      slug: content.slug,
      status: content.status,
      metadata: { ...content.metadata },
      createdAt: content.createdAt,
      updatedAt: content.updatedAt,
      publishedAt: content.publishedAt,
      revisions: content.revisions.map((revision) => ({
        id: revision.id,
        action: revision.action,
        timestamp: revision.timestamp,
        state: {
          ...revision.state,
          metadata: { ...revision.state.metadata }
        }
      }))
    };
  }
}

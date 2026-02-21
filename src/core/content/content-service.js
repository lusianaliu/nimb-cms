import { randomUUID } from 'node:crypto';
import { ContentModel } from './models/content-model.js';
import { createDefaultBlockRegistry } from './blocks/built-in-blocks.js';
import { BlockValidator } from './blocks/block-validator.js';

export class ContentService {
  constructor(options = {}) {
    this.contents = new Map();
    this.taxonomyService = options.taxonomyService ?? null;
    this.eventBus = options.eventBus ?? null;
    this.blockRegistry = options.blockRegistry ?? createDefaultBlockRegistry();
    this.blockValidator = options.blockValidator ?? new BlockValidator({ registry: this.blockRegistry });
  }

  listRegisteredBlocks() {
    return this.blockRegistry.list().map((definition) => ({
      type: definition.type,
      version: definition.version,
      schema: this.cloneJsonValue(definition.schema)
    }));
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

    const body = this.normalizeBody(input?.body);
    if (!body.ok) {
      return { ok: false, error: body.error };
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
      body: body.value,
      metadata,
      createdAt: now,
      updatedAt: now,
      publishedAt: null,
      revisions: []
    });

    this.recordRevision(content, 'created');
    this.contents.set(content.id, content);

    if (input?.taxonomyTermIds !== undefined) {
      const assignmentResult = this.assignTaxonomy(content.id, input.taxonomyTermIds);
      if (!assignmentResult.ok) {
        this.contents.delete(content.id);
        return assignmentResult;
      }
    }

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

    if (input?.body !== undefined) {
      const body = this.normalizeBody(input.body);
      if (!body.ok) {
        return { ok: false, error: body.error };
      }

      content.body = body.value;
    }

    if (input?.taxonomyTermIds !== undefined) {
      const assignmentResult = this.assignTaxonomy(content.id, input.taxonomyTermIds);
      if (!assignmentResult.ok) {
        return assignmentResult;
      }
    }

    content.status = 'draft';
    content.updatedAt = new Date().toISOString();
    this.recordRevision(content, 'draft-updated');

    return { ok: true, content: this.serializeContent(content) };
  }

  duplicateContent(id) {
    const sourceContent = this.contents.get(id);
    if (!sourceContent) {
      return { ok: false, error: 'Content not found' };
    }

    const duplicatedAt = new Date().toISOString();
    const duplicate = new ContentModel({
      id: randomUUID(),
      type: sourceContent.type,
      title: `${sourceContent.title} (Copy)`,
      slug: this.createUniqueSlug(sourceContent.slug),
      status: 'draft',
      body: this.cloneJsonValue(sourceContent.body),
      metadata: { ...sourceContent.metadata },
      createdAt: duplicatedAt,
      updatedAt: duplicatedAt,
      publishedAt: null,
      revisions: []
    });

    this.recordRevision(duplicate, 'duplicated');
    this.contents.set(duplicate.id, duplicate);

    if (this.taxonomyService) {
      this.taxonomyService.copyTermsBetweenContent(sourceContent.id, duplicate.id);
    }

    this.eventBus?.emit('nimb.content.duplicated', {
      sourceContentId: sourceContent.id,
      duplicatedContentId: duplicate.id,
      timestamp: duplicatedAt
    });

    return { ok: true, content: this.serializeContent(duplicate) };
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

  assignTaxonomy(contentId, taxonomyTermIds) {
    const content = this.contents.get(contentId);
    if (!content) {
      return { ok: false, error: 'Content not found' };
    }

    if (!this.taxonomyService) {
      return { ok: false, error: 'Taxonomy service unavailable' };
    }

    const assignmentResult = this.taxonomyService.setTermsForContent(content.id, taxonomyTermIds);
    if (!assignmentResult.ok) {
      return { ok: false, error: assignmentResult.error };
    }

    content.updatedAt = new Date().toISOString();
    this.recordRevision(content, 'taxonomy-assigned');

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

  normalizeBody(bodyInput) {
    const body = bodyInput ?? [];
    const validation = this.blockValidator.validateBody(body);
    if (!validation.ok) {
      return { ok: false, error: `Invalid block body: ${validation.errors.join('; ')}` };
    }

    return { ok: true, value: this.cloneJsonValue(body) };
  }

  cloneJsonValue(value) {
    return JSON.parse(JSON.stringify(value));
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
        body: this.cloneJsonValue(content.body),
        metadata: { ...content.metadata },
        taxonomyTermIds: this.taxonomyService ? this.taxonomyService.getTermIdsForContent(content.id) : [],
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
      body: this.cloneJsonValue(content.body),
      metadata: { ...content.metadata },
      taxonomyTermIds: this.taxonomyService ? this.taxonomyService.getTermIdsForContent(content.id) : [],
      createdAt: content.createdAt,
      updatedAt: content.updatedAt,
      publishedAt: content.publishedAt,
      revisions: content.revisions.map((revision) => ({
        id: revision.id,
        action: revision.action,
        timestamp: revision.timestamp,
        state: {
          ...revision.state,
          body: this.cloneJsonValue(revision.state.body),
          metadata: { ...revision.state.metadata },
          taxonomyTermIds: [...(revision.state.taxonomyTermIds ?? [])]
        }
      }))
    };
  }
}

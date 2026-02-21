import { randomUUID } from 'node:crypto';
import { TaxonomyModel } from './models/taxonomy-model.js';
import { TaxonomyTermModel } from './models/taxonomy-term-model.js';

export class TaxonomyService {
  constructor() {
    this.taxonomies = new Map();
    this.taxonomiesByKey = new Map();
    this.terms = new Map();
    this.termIdsByTaxonomy = new Map();
    this.contentTermIds = new Map();
  }

  createTaxonomy(input) {
    const key = this.normalizeKey(input?.key);
    if (!key) {
      return { ok: false, error: 'Taxonomy key is required and must contain letters or numbers' };
    }

    if (this.taxonomiesByKey.has(key)) {
      return { ok: false, error: 'Taxonomy key must be unique' };
    }

    if (typeof input?.label !== 'string' || !input.label.trim()) {
      return { ok: false, error: 'Taxonomy label is required' };
    }

    const metadata = this.normalizeMetadata(input?.metadata);
    if (!metadata) {
      return { ok: false, error: 'Metadata must be a key-value object' };
    }

    const id = randomUUID();
    const now = new Date().toISOString();
    const taxonomy = new TaxonomyModel({
      id,
      key,
      label: input.label.trim(),
      hierarchical: input?.hierarchical !== false,
      metadata,
      createdAt: now,
      updatedAt: now
    });

    this.taxonomies.set(id, taxonomy);
    this.taxonomiesByKey.set(key, id);

    return { ok: true, taxonomy: this.serializeTaxonomy(taxonomy) };
  }

  listTaxonomies() {
    return Array.from(this.taxonomies.values()).map((taxonomy) => this.serializeTaxonomy(taxonomy));
  }

  createTerm(taxonomyId, input) {
    const taxonomy = this.taxonomies.get(taxonomyId);
    if (!taxonomy) {
      return { ok: false, error: 'Taxonomy not found' };
    }

    if (typeof input?.name !== 'string' || !input.name.trim()) {
      return { ok: false, error: 'Term name is required' };
    }

    const parentTermId = input?.parentTermId ?? null;
    if (parentTermId) {
      if (!taxonomy.hierarchical) {
        return { ok: false, error: 'Parent term is not allowed in non-hierarchical taxonomy' };
      }

      const parentTerm = this.terms.get(parentTermId);
      if (!parentTerm || parentTerm.taxonomyId !== taxonomyId) {
        return { ok: false, error: 'Parent term is invalid for taxonomy' };
      }
    }

    const slug = this.createUniqueTermSlug(taxonomyId, input?.slug ?? input.name);
    const metadata = this.normalizeMetadata(input?.metadata);
    if (!metadata) {
      return { ok: false, error: 'Metadata must be a key-value object' };
    }

    const now = new Date().toISOString();
    const term = new TaxonomyTermModel({
      id: randomUUID(),
      taxonomyId,
      name: input.name.trim(),
      slug,
      parentTermId,
      metadata,
      createdAt: now,
      updatedAt: now
    });

    this.terms.set(term.id, term);

    if (!this.termIdsByTaxonomy.has(taxonomyId)) {
      this.termIdsByTaxonomy.set(taxonomyId, new Set());
    }

    this.termIdsByTaxonomy.get(taxonomyId).add(term.id);

    return { ok: true, term: this.serializeTerm(term) };
  }

  listTerms(taxonomyId) {
    const taxonomy = this.taxonomies.get(taxonomyId);
    if (!taxonomy) {
      return { ok: false, error: 'Taxonomy not found' };
    }

    const termIds = this.termIdsByTaxonomy.get(taxonomyId) ?? new Set();
    const terms = Array.from(termIds)
      .map((termId) => this.terms.get(termId))
      .filter(Boolean)
      .map((term) => this.serializeTerm(term));

    return { ok: true, terms };
  }

  setTermsForContent(contentId, termIds) {
    if (!Array.isArray(termIds)) {
      return { ok: false, error: 'termIds must be an array' };
    }

    const normalizedTermIds = [];
    for (const termId of termIds) {
      if (typeof termId !== 'string' || !termId.trim()) {
        return { ok: false, error: 'termIds must contain valid identifiers' };
      }

      const term = this.terms.get(termId);
      if (!term) {
        return { ok: false, error: `Term not found: ${termId}` };
      }

      normalizedTermIds.push(term.id);
    }

    this.contentTermIds.set(contentId, new Set(normalizedTermIds));
    return { ok: true, termIds: this.getTermIdsForContent(contentId) };
  }

  copyTermsBetweenContent(sourceContentId, targetContentId) {
    const sourceTermIds = this.contentTermIds.get(sourceContentId);
    if (!sourceTermIds) {
      this.contentTermIds.delete(targetContentId);
      return [];
    }

    const cloned = new Set(sourceTermIds);
    this.contentTermIds.set(targetContentId, cloned);
    return Array.from(cloned);
  }

  getTermIdsForContent(contentId) {
    return Array.from(this.contentTermIds.get(contentId) ?? []);
  }

  normalizeKey(source) {
    if (typeof source !== 'string') {
      return null;
    }

    const normalized = source
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');

    return normalized || null;
  }

  createUniqueTermSlug(taxonomyId, source) {
    const base = this.normalizeSlug(source) ?? `term-${randomUUID().slice(0, 8)}`;
    let candidate = base;
    let suffix = 1;

    while (this.termSlugExists(taxonomyId, candidate)) {
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

  termSlugExists(taxonomyId, slug) {
    const termIds = this.termIdsByTaxonomy.get(taxonomyId);
    if (!termIds) {
      return false;
    }

    for (const termId of termIds) {
      const term = this.terms.get(termId);
      if (term?.slug === slug) {
        return true;
      }
    }

    return false;
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

  serializeTaxonomy(taxonomy) {
    return {
      id: taxonomy.id,
      key: taxonomy.key,
      label: taxonomy.label,
      hierarchical: taxonomy.hierarchical,
      metadata: { ...taxonomy.metadata },
      createdAt: taxonomy.createdAt,
      updatedAt: taxonomy.updatedAt
    };
  }

  serializeTerm(term) {
    return {
      id: term.id,
      taxonomyId: term.taxonomyId,
      name: term.name,
      slug: term.slug,
      parentTermId: term.parentTermId,
      metadata: { ...term.metadata },
      createdAt: term.createdAt,
      updatedAt: term.updatedAt
    };
  }
}

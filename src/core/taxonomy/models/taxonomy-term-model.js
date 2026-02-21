export class TaxonomyTermModel {
  constructor({
    id,
    taxonomyId,
    name,
    slug,
    parentTermId,
    metadata,
    createdAt,
    updatedAt
  }) {
    this.id = id;
    this.taxonomyId = taxonomyId;
    this.name = name;
    this.slug = slug;
    this.parentTermId = parentTermId;
    this.metadata = metadata;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
}

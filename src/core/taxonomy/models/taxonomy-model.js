export class TaxonomyModel {
  constructor({ id, key, label, hierarchical, metadata, createdAt, updatedAt }) {
    this.id = id;
    this.key = key;
    this.label = label;
    this.hierarchical = hierarchical;
    this.metadata = metadata;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
}

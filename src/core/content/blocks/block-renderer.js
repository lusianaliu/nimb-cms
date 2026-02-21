export class BlockRenderer {
  renderBlock() {
    throw new Error('BlockRenderer.renderBlock must be implemented by adapters');
  }

  renderDocument(blocks) {
    if (!Array.isArray(blocks)) {
      throw new Error('renderDocument expects an array of blocks');
    }

    return blocks.map((block) => this.renderBlock(block));
  }
}

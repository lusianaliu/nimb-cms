export class StorageAdapter {
  async read(_key) {
    throw new Error('StorageAdapter.read not implemented');
  }

  async write(_key, _data) {
    throw new Error('StorageAdapter.write not implemented');
  }

  async delete(_key) {
    throw new Error('StorageAdapter.delete not implemented');
  }

  async list(_prefix = '') {
    throw new Error('StorageAdapter.list not implemented');
  }
}

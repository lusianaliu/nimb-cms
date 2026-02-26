export type ContentSnapshot = {
  entries: Record<string, any>
};

export interface StorageAdapter {
  loadContentSnapshot(): Promise<ContentSnapshot | null>
  saveContentSnapshot(snapshot: ContentSnapshot): Promise<void>
}

export type QueryOptions = {
  limit?: number
  offset?: number
  sort?: string
};

export type DatabaseRecord = {
  id: string
  type: string
  data: Record<string, unknown>
  createdAt: string
  updatedAt: string
};

export interface DatabaseAdapter {
  create(type: string, data: Record<string, unknown>): DatabaseRecord
  get(type: string, id: string): DatabaseRecord | undefined
  update(type: string, id: string, data: Record<string, unknown>): DatabaseRecord
  delete(type: string, id: string): void
  query(type: string, options?: QueryOptions): DatabaseRecord[]
}

import type { ContentEntry } from './content-entry.ts';

export const CONTENT_CREATED_EVENT = 'content.created';
export const CONTENT_UPDATED_EVENT = 'content.updated';
export const CONTENT_DELETED_EVENT = 'content.deleted';

export type ContentMutationEventPayload = {
  type: string
  entry: ContentEntry
};

export type ContentEvents = {
  [CONTENT_CREATED_EVENT]: ContentMutationEventPayload
  [CONTENT_UPDATED_EVENT]: ContentMutationEventPayload
  [CONTENT_DELETED_EVENT]: ContentMutationEventPayload
};

import { resolvePagePublishState, resolvePostPublishState } from '../content/publish-timing.ts';

export type ScheduledContentItem = {
  id: string
  title: string
  typeLabel: 'Page' | 'Post'
  publishTimeLabel: string
  editUrl: string
  publishedAtMs: number
};

const formatScheduledTime = (value: unknown) => {
  const raw = `${value ?? ''}`.trim();
  if (!raw) {
    return 'Unknown';
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return raw;
  }

  return parsed.toISOString().slice(0, 16).replace('T', ' ');
};

export const listScheduledContentItems = (runtime): ScheduledContentItem[] => {
  const pages = Array.isArray(runtime?.content?.list?.('page')) ? runtime.content.list('page') : [];
  const posts = Array.isArray(runtime?.content?.list?.('post')) ? runtime.content.list('post') : [];

  const scheduledPages = pages
    .filter((entry) => resolvePagePublishState(entry).status === 'scheduled')
    .map((entry) => {
      const id = `${entry?.id ?? ''}`;
      const publishedAtMs = new Date(`${entry?.data?.publishedAt ?? ''}`).getTime();
      return {
        id,
        title: `${entry?.data?.title ?? 'Untitled page'}`,
        typeLabel: 'Page' as const,
        publishTimeLabel: formatScheduledTime(entry?.data?.publishedAt),
        editUrl: `/admin/pages/${encodeURIComponent(id)}/edit`,
        publishedAtMs
      };
    });

  const scheduledPosts = posts
    .filter((entry) => resolvePostPublishState(entry).status === 'scheduled')
    .map((entry) => {
      const id = `${entry?.id ?? ''}`;
      const publishedAtMs = new Date(`${entry?.data?.publishedAt ?? ''}`).getTime();
      return {
        id,
        title: `${entry?.data?.title ?? 'Untitled post'}`,
        typeLabel: 'Post' as const,
        publishTimeLabel: formatScheduledTime(entry?.data?.publishedAt),
        editUrl: `/admin/posts/${encodeURIComponent(id)}/edit`,
        publishedAtMs
      };
    });

  return [...scheduledPages, ...scheduledPosts]
    .sort((left, right) => left.publishedAtMs - right.publishedAtMs);
};

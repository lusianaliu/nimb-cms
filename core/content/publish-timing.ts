const normalizeStatus = (value: unknown) => {
  const status = `${value ?? ''}`.trim().toLowerCase();

  if (status === 'draft') {
    return 'draft';
  }

  return 'published';
};

const parseDate = (value: unknown) => {
  const raw = `${value ?? ''}`.trim();
  if (!raw) {
    return null;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
};

const resolvePublishState = (entry, now = new Date()) => {
  const status = normalizeStatus(entry?.data?.status);
  const publishedAt = parseDate(entry?.data?.publishedAt);

  if (status === 'draft') {
    return Object.freeze({
      status: 'draft',
      publishedAt,
      isPublic: false
    });
  }

  if (publishedAt && publishedAt.getTime() > now.getTime()) {
    return Object.freeze({
      status: 'scheduled',
      publishedAt,
      isPublic: false
    });
  }

  return Object.freeze({
    status: 'published',
    publishedAt,
    isPublic: true
  });
};

export const resolvePostPublishState = (entry, now = new Date()) => resolvePublishState(entry, now);

export const resolvePagePublishState = (entry, now = new Date()) => resolvePublishState(entry, now);

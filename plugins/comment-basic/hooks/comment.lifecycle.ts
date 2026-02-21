/**
 * Architectural intent:
 * Lifecycle hooks remain deterministic, isolated, and failure-safe.
 * They only emit structured logs and avoid side effects on platform internals.
 */

type HookEvent = {
  hook: 'onCommentCreate' | 'beforeCommentSave' | 'afterCommentPublish';
  entityType: string;
  payload: unknown;
};

type HookLogger = {
  info: (message: string, metadata?: Record<string, unknown>) => void;
  warn: (message: string, metadata?: Record<string, unknown>) => void;
  error: (message: string, metadata?: Record<string, unknown>) => void;
};

type HookRegistration = {
  name: HookEvent['hook'];
  order: number;
  handler: (event: HookEvent) => Promise<void>;
};

const summarizePayload = (payload: unknown) => {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const commentRecord = payload as Record<string, unknown>;
    return {
      status: typeof commentRecord.status === 'string' ? commentRecord.status : 'unknown',
      hasContent: typeof commentRecord.content === 'string' && commentRecord.content.length > 0
    };
  }

  return {
    status: 'unknown',
    hasContent: false
  };
};

export const createCommentLifecycleHooks = (logger: HookLogger): HookRegistration[] => {
  const safeLog = async (phase: string, event: HookEvent): Promise<void> => {
    try {
      logger.info('comment-basic lifecycle event', {
        phase,
        hook: event.hook,
        entityType: event.entityType,
        payloadSummary: summarizePayload(event.payload)
      });
    } catch (error) {
      logger.warn('comment-basic hook logger failure isolated', {
        phase,
        hook: event.hook,
        reason: (error as Error).message
      });
    }
  };

  return [
    {
      name: 'onCommentCreate',
      order: 10,
      handler: async (event) => safeLog('register', event)
    },
    {
      name: 'beforeCommentSave',
      order: 20,
      handler: async (event) => safeLog('pre-save', event)
    },
    {
      name: 'afterCommentPublish',
      order: 30,
      handler: async (event) => safeLog('post-publish', event)
    }
  ];
};

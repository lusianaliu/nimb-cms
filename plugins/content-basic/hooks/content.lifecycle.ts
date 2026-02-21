/**
 * Architectural intent:
 * Hooks are isolated and deterministic by explicit order metadata.
 * All behavior is simulation-only via logger output.
 */

type HookEvent = {
  hook: 'onContentCreate' | 'beforeContentSave' | 'afterContentPublish';
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

export const createContentLifecycleHooks = (logger: HookLogger): HookRegistration[] => {
  const safeLog = async (phase: string, event: HookEvent): Promise<void> => {
    try {
      logger.info('content-basic lifecycle event', {
        phase,
        hook: event.hook,
        entityType: event.entityType
      });
    } catch (error) {
      logger.warn('content-basic hook logger failure isolated', {
        phase,
        hook: event.hook,
        reason: (error as Error).message
      });
    }
  };

  return [
    {
      name: 'onContentCreate',
      order: 10,
      handler: async (event) => safeLog('register', event)
    },
    {
      name: 'beforeContentSave',
      order: 20,
      handler: async (event) => safeLog('pre-save', event)
    },
    {
      name: 'afterContentPublish',
      order: 30,
      handler: async (event) => safeLog('post-publish', event)
    }
  ];
};

import { createPublicRouter } from './public-router.ts';

// Legacy compatibility wrapper.
// Phase 144 lock-in: public route ownership is canonical in createPublicRouter().
export const createSiteRouter = (runtime) => createPublicRouter(runtime);

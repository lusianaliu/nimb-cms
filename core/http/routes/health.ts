import { jsonResponse } from '../response.ts';
import { resolveRuntimeMode, version } from '../../runtime/version.ts';

export const createHealthRoute = ({ config } = {}) => ({
  method: 'GET',
  path: '/health',
  handler: () => jsonResponse({
    status: 'ok',
    runtime: 'active',
    version,
    mode: resolveRuntimeMode(config?.runtime?.mode)
  })
});

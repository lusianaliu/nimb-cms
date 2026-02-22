import { jsonResponse } from '../response.ts';

export const createHealthRoute = () => ({
  method: 'GET',
  path: '/health',
  handler: () => jsonResponse({ status: 'ok', runtime: 'active' })
});

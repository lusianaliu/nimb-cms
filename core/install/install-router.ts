import { createRouter } from '../http/router.ts';
import { jsonResponse } from '../http/response.ts';

export const createInstallRouter = (_runtime) => createRouter([
  {
    method: 'GET',
    path: '/',
    handler: () => jsonResponse({
      status: 'install',
      message: 'Nimb is not installed'
    })
  }
]);

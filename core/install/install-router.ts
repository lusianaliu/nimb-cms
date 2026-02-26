import { createRouter } from '../http/router.ts';
import { jsonResponse } from '../http/response.ts';
import { isInstalled, markInstalled } from '../setup/setup-state.ts';

export const createInstallRouter = (_runtime) => createRouter([
  {
    method: 'GET',
    path: '/',
    handler: () => jsonResponse({
      status: 'install',
      message: 'Nimb is not installed'
    })
  },
  {
    method: 'POST',
    path: '/install',
    handler: () => {
      if (isInstalled()) {
        return jsonResponse({ error: 'Already installed' }, { statusCode: 409 });
      }

      markInstalled({ version: '0.1.0' });

      return jsonResponse({
        status: 'installed',
        rebootRequired: true
      });
    }
  }
]);

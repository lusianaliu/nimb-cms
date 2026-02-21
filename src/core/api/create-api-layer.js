import { ApiAuthenticationMiddleware } from './api-authentication-middleware.js';
import { ApiContentController } from './api-content-controller.js';
import { ApiTaxonomyController } from './api-taxonomy-controller.js';
import { ApiRouter } from './api-router.js';

export function createApiLayer(options) {
  const authenticationMiddleware = new ApiAuthenticationMiddleware({
    userSessions: options.userSessions,
    adminSessions: options.adminSessions,
    userCookieName: options.userCookieName,
    adminCookieName: options.adminCookieName
  });

  const contentController = new ApiContentController({
    contentService: options.contentService
  });

  const taxonomyController = new ApiTaxonomyController({
    taxonomyService: options.taxonomyService
  });

  return new ApiRouter({
    authenticationMiddleware,
    contentController,
    taxonomyController
  });
}

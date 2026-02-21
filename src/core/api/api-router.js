import { respondJson } from './json-http.js';

export class ApiRouter {
  constructor(options) {
    this.authenticationMiddleware = options.authenticationMiddleware;
    this.contentController = options.contentController;
    this.taxonomyController = options.taxonomyController;
  }

  async handle(req, res) {
    const url = new URL(req.url, 'http://localhost');
    const path = url.pathname;

    if (!path.startsWith('/api/v1')) {
      return false;
    }

    const authentication = this.authenticationMiddleware.authenticate(req, res);
    if (!authentication.ok) {
      return true;
    }

    const handledByContentController = await this.contentController.handle(req, res);
    if (handledByContentController) {
      return true;
    }

    const handledByTaxonomyController = await this.taxonomyController.handle(req, res);
    if (handledByTaxonomyController) {
      return true;
    }

    respondJson(res, 404, { error: 'API endpoint not found', code: 'API_ROUTE_NOT_FOUND' });
    return true;
  }
}

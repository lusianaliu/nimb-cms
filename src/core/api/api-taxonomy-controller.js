import { readJsonBody, respondJson } from './json-http.js';

const TERM_PATH_PATTERN = /^\/api\/v1\/taxonomies\/([a-z0-9-]+)\/terms$/i;

export class ApiTaxonomyController {
  constructor(options) {
    this.taxonomyService = options.taxonomyService;
  }

  async handle(req, res) {
    const url = new URL(req.url, 'http://localhost');
    const path = url.pathname;

    if (req.method === 'POST' && path === '/api/v1/taxonomies') {
      return this.handleCreateTaxonomy(req, res);
    }

    if (req.method === 'GET' && path === '/api/v1/taxonomies') {
      return this.handleListTaxonomies(res);
    }

    const termPathMatch = path.match(TERM_PATH_PATTERN);
    if (termPathMatch && req.method === 'POST') {
      return this.handleCreateTerm(req, res, termPathMatch[1]);
    }

    if (termPathMatch && req.method === 'GET') {
      return this.handleListTerms(res, termPathMatch[1]);
    }

    return false;
  }

  async handleCreateTaxonomy(req, res) {
    const payload = await readJsonBody(req, res);
    if (!payload) {
      return true;
    }

    const result = this.taxonomyService.createTaxonomy(payload);
    if (!result.ok) {
      respondJson(res, 400, { error: result.error });
      return true;
    }

    respondJson(res, 201, result);
    return true;
  }

  handleListTaxonomies(res) {
    const taxonomies = this.taxonomyService.listTaxonomies();
    respondJson(res, 200, { ok: true, taxonomies });
    return true;
  }

  async handleCreateTerm(req, res, taxonomyId) {
    const payload = await readJsonBody(req, res);
    if (!payload) {
      return true;
    }

    const result = this.taxonomyService.createTerm(taxonomyId, payload);
    if (!result.ok) {
      respondJson(res, result.error === 'Taxonomy not found' ? 404 : 400, { error: result.error });
      return true;
    }

    respondJson(res, 201, result);
    return true;
  }

  handleListTerms(res, taxonomyId) {
    const result = this.taxonomyService.listTerms(taxonomyId);
    respondJson(res, result.ok ? 200 : 404, result.ok ? result : { error: result.error });
    return true;
  }
}

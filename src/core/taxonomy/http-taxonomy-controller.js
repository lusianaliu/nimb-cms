const JSON_HEADER = { 'Content-Type': 'application/json' };

export class HttpTaxonomyController {
  constructor(options) {
    this.taxonomyService = options.taxonomyService;
  }

  async handle(req, res) {
    const url = new URL(req.url, 'http://localhost');
    const path = url.pathname;

    if (req.method === 'POST' && path === '/taxonomies') {
      return this.handleCreateTaxonomy(req, res);
    }

    if (req.method === 'GET' && path === '/taxonomies') {
      return this.handleListTaxonomies(res);
    }

    const termPathMatch = path.match(/^\/taxonomies\/([a-z0-9-]+)\/terms$/i);
    if (termPathMatch && req.method === 'POST') {
      return this.handleCreateTerm(req, res, termPathMatch[1]);
    }

    if (termPathMatch && req.method === 'GET') {
      return this.handleListTerms(res, termPathMatch[1]);
    }

    return false;
  }

  async handleCreateTaxonomy(req, res) {
    const payload = await this.readJsonBody(req, res);
    if (!payload) {
      return true;
    }

    const result = this.taxonomyService.createTaxonomy(payload);
    if (!result.ok) {
      this.respond(res, 400, { error: result.error });
      return true;
    }

    this.respond(res, 201, result);
    return true;
  }

  handleListTaxonomies(res) {
    const taxonomies = this.taxonomyService.listTaxonomies();
    this.respond(res, 200, { ok: true, taxonomies });
    return true;
  }

  async handleCreateTerm(req, res, taxonomyId) {
    const payload = await this.readJsonBody(req, res);
    if (!payload) {
      return true;
    }

    const result = this.taxonomyService.createTerm(taxonomyId, payload);
    if (!result.ok) {
      this.respond(res, result.error === 'Taxonomy not found' ? 404 : 400, { error: result.error });
      return true;
    }

    this.respond(res, 201, result);
    return true;
  }

  handleListTerms(res, taxonomyId) {
    const result = this.taxonomyService.listTerms(taxonomyId);
    if (!result.ok) {
      this.respond(res, 404, { error: result.error });
      return true;
    }

    this.respond(res, 200, result);
    return true;
  }

  async readJsonBody(req, res) {
    const body = await new Promise((resolve, reject) => {
      let data = '';

      req.on('data', (chunk) => {
        data += chunk;
      });

      req.on('end', () => resolve(data));
      req.on('error', reject);
    });

    if (!body) {
      return {};
    }

    try {
      return JSON.parse(body);
    } catch {
      this.respond(res, 400, { error: 'Invalid JSON payload' });
      return null;
    }
  }

  respond(res, statusCode, payload) {
    res.writeHead(statusCode, JSON_HEADER);
    res.end(JSON.stringify(payload));
  }
}

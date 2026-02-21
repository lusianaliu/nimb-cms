const JSON_HEADER = { 'Content-Type': 'application/json' };

export class HttpContentController {
  constructor(options) {
    this.contentService = options.contentService;
  }

  async handle(req, res) {
    const url = new URL(req.url, 'http://localhost');
    const path = url.pathname;

    if (req.method === 'POST' && path === '/content') {
      return this.handleCreate(req, res);
    }

    if (req.method === 'GET' && path === '/content') {
      return this.handleList(res);
    }

    const contentByIdMatch = path.match(/^\/content\/([a-z0-9-]+)$/i);
    if (contentByIdMatch && req.method === 'GET') {
      return this.handleGetById(res, contentByIdMatch[1]);
    }

    if (contentByIdMatch && req.method === 'PATCH') {
      return this.handleUpdate(req, res, contentByIdMatch[1]);
    }

    const publishMatch = path.match(/^\/content\/([a-z0-9-]+)\/publish$/i);
    if (publishMatch && req.method === 'POST') {
      return this.handlePublish(res, publishMatch[1]);
    }

    const draftMatch = path.match(/^\/content\/([a-z0-9-]+)\/draft$/i);
    if (draftMatch && req.method === 'POST') {
      return this.handleMoveToDraft(res, draftMatch[1]);
    }

    return false;
  }

  async handleCreate(req, res) {
    const payload = await this.readJsonBody(req, res);
    if (!payload) {
      return true;
    }

    const result = this.contentService.createContent(payload);
    if (!result.ok) {
      this.respond(res, 400, { error: result.error });
      return true;
    }

    this.respond(res, 201, result);
    return true;
  }

  handleList(res) {
    const content = this.contentService.listContent();
    this.respond(res, 200, { ok: true, content });
    return true;
  }

  handleGetById(res, contentId) {
    const result = this.contentService.getContentById(contentId);
    this.respond(res, result.ok ? 200 : 404, result);
    return true;
  }

  async handleUpdate(req, res, contentId) {
    const payload = await this.readJsonBody(req, res);
    if (!payload) {
      return true;
    }

    const result = this.contentService.updateDraft(contentId, payload);
    if (!result.ok) {
      this.respond(res, result.error === 'Content not found' ? 404 : 400, { error: result.error });
      return true;
    }

    this.respond(res, 200, result);
    return true;
  }

  handlePublish(res, contentId) {
    const result = this.contentService.publishContent(contentId);
    this.respond(res, result.ok ? 200 : 404, result);
    return true;
  }

  handleMoveToDraft(res, contentId) {
    const result = this.contentService.moveToDraft(contentId);
    this.respond(res, result.ok ? 200 : 404, result);
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

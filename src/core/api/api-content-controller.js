import { readJsonBody, respondJson } from './json-http.js';

const CONTENT_ID_PATTERN = /^\/api\/v1\/content\/([a-z0-9-]+)$/i;
const DUPLICATE_ID_PATTERN = /^\/api\/v1\/content\/([a-z0-9-]+)\/duplicate$/i;

export class ApiContentController {
  constructor(options) {
    this.contentService = options.contentService;
  }

  async handle(req, res) {
    const url = new URL(req.url, 'http://localhost');
    const path = url.pathname;

    if (req.method === 'POST' && path === '/api/v1/content') {
      return this.handleCreate(req, res);
    }

    if (req.method === 'GET' && path === '/api/v1/content') {
      return this.handleList(res);
    }

    const byIdMatch = path.match(CONTENT_ID_PATTERN);
    if (byIdMatch && req.method === 'GET') {
      return this.handleGetById(res, byIdMatch[1]);
    }

    if (byIdMatch && req.method === 'PATCH') {
      return this.handleUpdate(req, res, byIdMatch[1]);
    }

    if (byIdMatch && req.method === 'DELETE') {
      return this.handleDelete(res);
    }

    const duplicateMatch = path.match(DUPLICATE_ID_PATTERN);
    if (duplicateMatch && req.method === 'POST') {
      return this.handleDuplicate(res, duplicateMatch[1]);
    }

    return false;
  }

  async handleCreate(req, res) {
    const payload = await readJsonBody(req, res);
    if (!payload) {
      return true;
    }

    const result = this.contentService.createContent(payload);
    if (!result.ok) {
      respondJson(res, 400, { error: result.error });
      return true;
    }

    respondJson(res, 201, result);
    return true;
  }

  handleList(res) {
    const content = this.contentService.listContent();
    respondJson(res, 200, { ok: true, content });
    return true;
  }

  handleGetById(res, contentId) {
    const result = this.contentService.getContentById(contentId);
    respondJson(res, result.ok ? 200 : 404, result.ok ? result : { error: result.error });
    return true;
  }

  async handleUpdate(req, res, contentId) {
    const payload = await readJsonBody(req, res);
    if (!payload) {
      return true;
    }

    const result = this.contentService.updateDraft(contentId, payload);
    if (!result.ok) {
      respondJson(res, result.error === 'Content not found' ? 404 : 400, { error: result.error });
      return true;
    }

    respondJson(res, 200, result);
    return true;
  }

  handleDelete(res) {
    respondJson(res, 501, {
      error: 'Delete content is not available in the current core content service',
      code: 'CONTENT_DELETE_NOT_SUPPORTED'
    });
    return true;
  }

  handleDuplicate(res, contentId) {
    const result = this.contentService.duplicateContent(contentId);
    respondJson(res, result.ok ? 201 : 404, result.ok ? result : { error: result.error });
    return true;
  }
}

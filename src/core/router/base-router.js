import http from 'node:http';

export class BaseRouter {
  constructor(options) {
    this.logger = options.logger;
    this.authRouter = options.authRouter;
    this.contentController = options.contentController;
  }

  createServer() {
    return http.createServer(async (req, res) => {
      if (req.method === 'GET' && req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok' }));
        return;
      }

      const handledByAuth = await this.authRouter.handle(req, res);
      if (handledByAuth) {
        return;
      }

      const handledByContent = await this.contentController.handle(req, res);
      if (handledByContent) {
        return;
      }

      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not Found' }));
    });
  }
}

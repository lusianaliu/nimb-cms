import http from 'node:http';

export class BaseRouter {
  constructor(options) {
    this.logger = options.logger;
    this.authRouter = options.authRouter;
    this.contentController = options.contentController;
    this.taxonomyController = options.taxonomyController;
    this.pluginRoutes = [];
  }


  registerPluginRoute(handler) {
    this.pluginRoutes.push(handler);
    return () => {
      this.pluginRoutes = this.pluginRoutes.filter((routeHandler) => routeHandler !== handler);
    };
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

      const handledByTaxonomy = await this.taxonomyController.handle(req, res);
      if (handledByTaxonomy) {
        return;
      }

      for (const pluginRoute of this.pluginRoutes) {
        const handledByPlugin = await Promise.resolve(pluginRoute(req, res));
        if (handledByPlugin) {
          return;
        }
      }

      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not Found' }));
    });
  }
}

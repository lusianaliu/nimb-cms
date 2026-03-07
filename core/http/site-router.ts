import { createPublicRouter } from './public-router.ts';

const toHtmlResponse = (html: string, statusCode = 200) => ({
  statusCode,
  send(response) {
    const body = Buffer.from(html, 'utf8');
    response.writeHead(statusCode, {
      'content-length': body.byteLength,
      'content-type': 'text/html; charset=utf-8'
    });
    response.end(body);
  }
});

export const createSiteRouter = (runtime) => {
  const router = createPublicRouter(runtime);

  router.register({
    method: 'GET',
    path: '/',
    handler: () => {
      const html = runtime?.themeRenderer?.renderThemePage?.('index', runtime);
      return toHtmlResponse(html ?? '');
    }
  });

  return router;
};

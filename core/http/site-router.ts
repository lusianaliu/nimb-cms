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

  router.register({
    method: 'GET',
    path: '/:slug',
    handler: (context) => {
      const slug = `${context?.params?.slug ?? ''}`;
      const page = runtime.content.list('page').find((entry) => entry?.data?.slug === slug);

      if (!page) {
        return toHtmlResponse('Not Found', 404);
      }

      const html = runtime?.themeRenderer?.renderThemePage?.('page', runtime, {
        title: `${page?.data?.title ?? ''}`,
        body: `${page?.data?.body ?? ''}`
      });

      return toHtmlResponse(html ?? '');
    }
  });

  return router;
};

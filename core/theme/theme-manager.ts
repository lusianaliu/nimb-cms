import { createDefaultPublicTheme } from './default/index.ts';

export interface ThemeRenderer {
  activePublicTheme: ReturnType<typeof createDefaultPublicTheme>
  defaultPublicTheme: ReturnType<typeof createDefaultPublicTheme>
  renderHome(data: Record<string, unknown>): string
  renderPage(data: Record<string, unknown>): string
  renderPost(data: Record<string, unknown>): string
}

const toContext = (data: Record<string, unknown>) => ({
  site: {
    name: `${data?.siteName ?? 'My Nimb Site'}`,
    description: ''
  },
  route: {
    path: `${data?.path ?? '/'}`,
    params: {}
  },
  content: data,
  navigation: [
    { label: 'Home', url: '/' },
    { label: 'Blog', url: '/blog' }
  ]
});

export function createThemeManager(): ThemeRenderer {
  const defaultPublicTheme = createDefaultPublicTheme();

  return Object.freeze({
    activePublicTheme: defaultPublicTheme,
    defaultPublicTheme,
    renderHome(data) {
      return defaultPublicTheme.render('home', toContext(data ?? {}));
    },
    renderPage(data) {
      return defaultPublicTheme.render('page', toContext({ ...data, page: data }));
    },
    renderPost(data) {
      return defaultPublicTheme.render('blog-single', toContext({ ...data, post: data }));
    }
  });
}

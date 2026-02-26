import fs from 'node:fs';
import path from 'node:path';

export interface ThemeRenderer {
  renderHome(data: Record<string, unknown>): string
  renderPage(data: Record<string, unknown>): string
  renderPost(data: Record<string, unknown>): string
}

const DEFAULT_THEME = 'default';

const htmlEscape = (value: unknown): string => `${value ?? ''}`
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const readTemplate = (themeRoot: string, fileName: string): string => fs.readFileSync(path.join(themeRoot, fileName), 'utf8');

const resolveThemeRoot = (projectRoot: string, activeTheme: string): string => {
  const projectThemeRoot = path.resolve(projectRoot, 'themes', activeTheme);
  if (fs.existsSync(projectThemeRoot)) {
    return projectThemeRoot;
  }

  return path.resolve(process.cwd(), 'themes', activeTheme);
};

const renderTemplate = (template: string, variables: Record<string, unknown>): string => template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_token, key) => htmlEscape(variables[key] ?? ''));

const renderWithLayout = (layoutTemplate: string, pageTemplate: string, variables: Record<string, unknown>): string => {
  const body = renderTemplate(pageTemplate, variables);
  return renderTemplate(layoutTemplate, { ...variables, content: body });
};

const renderPostList = (posts: Array<Record<string, unknown>>): string => {
  if (!Array.isArray(posts) || posts.length === 0) {
    return '<p>No posts yet.</p>';
  }

  const items = posts.map((post) => {
    const title = htmlEscape(post.title ?? 'Untitled');
    const slug = encodeURIComponent(`${post.slug ?? ''}`);
    return `<li><a href="/post/${slug}">${title}</a></li>`;
  }).join('');

  return `<ul>${items}</ul>`;
};

export function createThemeManager(runtime): ThemeRenderer {
  const activeTheme = `${runtime?.config?.site?.theme ?? DEFAULT_THEME}`;
  const projectRoot = runtime?.projectPaths?.projectRoot ?? runtime?.project?.projectRoot ?? process.cwd();
  const themeRoot = resolveThemeRoot(projectRoot, activeTheme);
  const layoutTemplate = readTemplate(themeRoot, 'layout.html');
  const homeTemplate = readTemplate(themeRoot, 'home.html');
  const pageTemplate = readTemplate(themeRoot, 'page.html');
  const postTemplate = readTemplate(themeRoot, 'post.html');

  return Object.freeze({
    renderHome(data) {
      const content = data?.content ?? renderPostList((data?.posts as Array<Record<string, unknown>>) ?? []);
      return renderWithLayout(layoutTemplate, homeTemplate, { ...data, content });
    },
    renderPage(data) {
      return renderWithLayout(layoutTemplate, pageTemplate, data ?? {});
    },
    renderPost(data) {
      return renderWithLayout(layoutTemplate, postTemplate, data ?? {});
    }
  });
}

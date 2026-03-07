import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_THEME_NAME = 'default';
const DEFAULT_SITE_NAME = 'My Nimb Site';

const replaceVariables = (template = '', variables: Record<string, unknown> = {}) => (
  template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, variableName) => `${variables[variableName] ?? ''}`)
);

const readTemplate = (filePath: string) => {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    throw new Error(`Theme template not found: ${filePath}`);
  }

  return fs.readFileSync(filePath, 'utf8');
};


const readSiteName = (runtime) => {
  try {
    const value = runtime?.settings?.get?.('site.name');
    if (typeof value === 'string' && value.trim() !== '') {
      return value;
    }
  } catch {
    // Default while settings content type is not initialized.
  }

  return DEFAULT_SITE_NAME;
};
export const createThemeRenderer = (runtime) => {
  const projectRoot = runtime?.projectPaths?.projectRoot ?? runtime?.project?.projectRoot ?? process.cwd();
  const fallbackProjectRoot = process.cwd();

  return Object.freeze({
    renderThemePage(page = 'index', rendererRuntime = runtime, pageVariables: Record<string, unknown> = {}) {
      const activeTheme = `${rendererRuntime?.theme?.activePublicTheme?.id ?? DEFAULT_THEME_NAME}`.trim() || DEFAULT_THEME_NAME;
      const siteName = readSiteName(rendererRuntime);
      const primaryThemePath = path.join(projectRoot, 'themes', activeTheme);
      const fallbackThemePath = path.join(fallbackProjectRoot, 'themes', activeTheme);
      const themePath = fs.existsSync(primaryThemePath) ? primaryThemePath : fallbackThemePath;
      const layoutTemplate = readTemplate(path.join(themePath, 'layout.html'));
      const pageTemplate = readTemplate(path.join(themePath, `${page}.html`));
      const pageContent = replaceVariables(pageTemplate, { siteName, ...pageVariables });
      const html = layoutTemplate.replace('{{content}}', pageContent);

      return replaceVariables(html, { siteName });
    }
  });
};

export const renderThemePage = (page, runtime) => createThemeRenderer(runtime).renderThemePage(page, runtime);

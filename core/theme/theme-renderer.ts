import { defaultThemeTemplates } from '../../themes/default/index.ts';

const DEFAULT_SITE_NAME = 'My Nimb Site';

const readSiteSettings = (runtime) => runtime?.settings?.getSettings?.() ?? {};

const readSiteName = (runtime) => {
  try {
    const settings = readSiteSettings(runtime);
    if (typeof settings.siteName === 'string' && settings.siteName.trim() !== '') {
      return settings.siteName;
    }

    const value = runtime?.settings?.get?.('site.name');
    if (typeof value === 'string' && value.trim() !== '') {
      return value;
    }
  } catch {
    // Default while settings storage is not initialized.
  }

  return DEFAULT_SITE_NAME;
};

const mapLegacyTemplateName = (templateName: string): string => {
  if (templateName === 'index' || templateName === 'home') {
    return 'homepage';
  }

  if (templateName === 'blog' || templateName === 'blog-list') {
    return 'post-list';
  }

  if (templateName === 'post' || templateName === 'blog-single') {
    return 'post-page';
  }

  return templateName;
};

export const createThemeRenderer = (runtime) => Object.freeze({
  renderTemplate(templateName = 'homepage', rendererRuntime = runtime, pageVariables: Record<string, unknown> = {}) {
    const resolvedTemplateName = mapLegacyTemplateName(templateName);
    const template = defaultThemeTemplates[resolvedTemplateName] ?? defaultThemeTemplates.page;

    return template({
      siteName: readSiteName(rendererRuntime),
      routePath: `${pageVariables.routePath ?? '/'}`,
      ...pageVariables
    });
  },
  renderThemePage(page = 'index', rendererRuntime = runtime, pageVariables: Record<string, unknown> = {}) {
    return this.renderTemplate(page, rendererRuntime, pageVariables);
  }
});

export const renderThemePage = (page, runtime) => createThemeRenderer(runtime).renderThemePage(page, runtime);

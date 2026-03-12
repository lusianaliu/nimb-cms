import {
  THEME_TEMPLATE_ALIASES,
  type CanonicalThemeTemplateName,
  type ThemeTemplateContext,
  type ThemeTemplateName
} from './theme-contract.ts';
import { defaultThemeTemplates } from '../../themes/default/index.ts';

const DEFAULT_SITE_NAME = 'My Nimb Site';
const DEFAULT_TAGLINE = 'Just another Nimb site';
const DEFAULT_HOMEPAGE_INTRO = 'This homepage is ready for a company profile website. Create and publish pages like About, Services, and Contact from admin.';

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

const isCanonicalTemplateName = (templateName: string): templateName is CanonicalThemeTemplateName =>
  Object.hasOwn(defaultThemeTemplates, templateName);

export const resolveCanonicalTemplateName = (templateName: ThemeTemplateName = 'homepage'): CanonicalThemeTemplateName => {
  const normalizedName = `${templateName}`.trim();
  const aliasTarget = THEME_TEMPLATE_ALIASES[normalizedName as keyof typeof THEME_TEMPLATE_ALIASES];
  const resolvedTemplateName = aliasTarget ?? normalizedName;

  return isCanonicalTemplateName(resolvedTemplateName) ? resolvedTemplateName : 'page';
};

const normalizeEntries = (value: unknown): ThemeTemplateContext['posts'] => Array.isArray(value)
  ? value
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry) => entry as ThemeTemplateContext['posts'][number])
  : [];

const toThemeTemplateContext = (runtime, pageVariables: Record<string, unknown> = {}): ThemeTemplateContext => {
  const settings = readSiteSettings(runtime);

  return {
    siteName: readSiteName(runtime),
    siteTagline: typeof settings.tagline === 'string' && settings.tagline.trim() ? settings.tagline : DEFAULT_TAGLINE,
    homepageIntro: typeof settings.homepageIntro === 'string' && settings.homepageIntro.trim() ? settings.homepageIntro : DEFAULT_HOMEPAGE_INTRO,
    footerText: typeof settings.footerText === 'string' ? settings.footerText : '',
    routePath: `${pageVariables.routePath ?? '/'}`,
    routeParams: pageVariables.routeParams && typeof pageVariables.routeParams === 'object'
      ? Object.fromEntries(Object.entries(pageVariables.routeParams as Record<string, unknown>).map(([key, value]) => [key, `${value}`]))
      : {},
    pages: normalizeEntries(pageVariables.pages),
    posts: normalizeEntries(pageVariables.posts),
    page: pageVariables.page && typeof pageVariables.page === 'object'
      ? pageVariables.page as ThemeTemplateContext['page']
      : undefined,
    post: pageVariables.post && typeof pageVariables.post === 'object'
      ? pageVariables.post as ThemeTemplateContext['post']
      : undefined
  };
};

export const createThemeRenderer = (runtime) => Object.freeze({
  renderTemplate(templateName: ThemeTemplateName = 'homepage', rendererRuntime = runtime, pageVariables: Record<string, unknown> = {}) {
    const resolvedTemplateName = resolveCanonicalTemplateName(templateName);
    const template = defaultThemeTemplates[resolvedTemplateName] ?? defaultThemeTemplates.page;
    return template(toThemeTemplateContext(rendererRuntime, pageVariables));
  },
  renderThemePage(page: ThemeTemplateName = 'index', rendererRuntime = runtime, pageVariables: Record<string, unknown> = {}) {
    return this.renderTemplate(page, rendererRuntime, pageVariables);
  }
});

export const renderThemePage = (page, runtime) => createThemeRenderer(runtime).renderThemePage(page, runtime);

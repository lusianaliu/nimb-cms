import {
  CANONICAL_THEME_TEMPLATE_NAMES,
  THEME_TEMPLATE_ALIASES,
  type CanonicalThemeTemplateName,
  type ThemeTemplateContext,
  type ThemeTemplateName
} from './theme-contract.ts';
import {
  DEFAULT_PUBLIC_THEME_ID,
  getBuiltinPublicThemeRecord,
  getDefaultPublicThemeTemplates,
  isRegisteredPublicThemeId,
  listBuiltinPublicThemes,
  resolvePublicThemeId,
  type RegisteredPublicTheme
} from './theme-registry.ts';

const DEFAULT_SITE_NAME = 'My Nimb Site';
const DEFAULT_TAGLINE = 'Just another Nimb site';
const DEFAULT_HOMEPAGE_INTRO = 'This homepage is ready for a company profile website. Create and publish pages like About, Services, and Contact from admin.';
export type ThemeTemplateRenderer = (context: ThemeTemplateContext) => string;
export type PublicThemeTemplateModule = Partial<Record<CanonicalThemeTemplateName, ThemeTemplateRenderer>>;

type ThemeRendererOptions = {
  publicThemes?: Record<string, PublicThemeTemplateModule>
};

const warnedThemeIssues = new Set<string>();

const warnThemeIssue = (runtime, issue: string) => {
  if (warnedThemeIssues.has(issue)) {
    return;
  }

  warnedThemeIssues.add(issue);

  if (typeof runtime?.logger?.warn === 'function') {
    runtime.logger.warn(issue);
    return;
  }

  console.warn(`[theme-renderer] ${issue}`);
};

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
  CANONICAL_THEME_TEMPLATE_NAMES.includes(templateName as CanonicalThemeTemplateName);

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

const readActiveThemeId = (runtime) => {
  const settingsTheme = `${readSiteSettings(runtime)?.theme ?? ''}`.trim();
  return settingsTheme || DEFAULT_PUBLIC_THEME_ID;
};

const validateThemeTemplates = (runtime, themeId: string, templates: PublicThemeTemplateModule): Record<CanonicalThemeTemplateName, ThemeTemplateRenderer> => {
  const defaultThemeTemplates = getDefaultPublicThemeTemplates();
  const normalizedTemplates = {} as Record<CanonicalThemeTemplateName, ThemeTemplateRenderer>;

  for (const templateName of CANONICAL_THEME_TEMPLATE_NAMES) {
    const templateRenderer = templates[templateName];

    if (typeof templateRenderer === 'function') {
      normalizedTemplates[templateName] = templateRenderer;
      continue;
    }

    warnThemeIssue(runtime, `Theme "${themeId}" is missing template "${templateName}". Falling back to default theme template.`);
    normalizedTemplates[templateName] = defaultThemeTemplates[templateName];
  }

  return normalizedTemplates;
};

const resolveActiveThemeTemplates = (runtime, publicThemes: Record<string, PublicThemeTemplateModule>): Record<CanonicalThemeTemplateName, ThemeTemplateRenderer> => {
  const configuredThemeId = readActiveThemeId(runtime);
  const activeThemeId = resolvePublicThemeId(configuredThemeId, publicThemes);
  const defaultThemeTemplates = getDefaultPublicThemeTemplates();

  if (!isRegisteredPublicThemeId(configuredThemeId, publicThemes)) {
    warnThemeIssue(runtime, `Theme "${configuredThemeId}" is not registered. Falling back to default theme.`);
    return validateThemeTemplates(runtime, DEFAULT_PUBLIC_THEME_ID, defaultThemeTemplates);
  }

  const selectedTheme = publicThemes[activeThemeId];

  return validateThemeTemplates(runtime, activeThemeId, selectedTheme);
};

export const listRegisteredPublicThemes = (): string[] => listBuiltinPublicThemes().map((theme) => theme.id);

export const listRegisteredPublicThemeDetails = (): RegisteredPublicTheme[] => listBuiltinPublicThemes();

export const createThemeRenderer = (runtime, options: ThemeRendererOptions = {}) => {
  const publicThemes = options.publicThemes ?? getBuiltinPublicThemeRecord();
  const defaultThemeTemplates = getDefaultPublicThemeTemplates();

  return Object.freeze({
  renderTemplate(templateName: ThemeTemplateName = 'homepage', rendererRuntime = runtime, pageVariables: Record<string, unknown> = {}) {
    const resolvedTemplateName = resolveCanonicalTemplateName(templateName);
    const activeThemeTemplates = resolveActiveThemeTemplates(rendererRuntime, publicThemes);
    const template = activeThemeTemplates[resolvedTemplateName] ?? defaultThemeTemplates.page;
    return template(toThemeTemplateContext(rendererRuntime, pageVariables));
  },
  renderThemePage(page: ThemeTemplateName = 'index', rendererRuntime = runtime, pageVariables: Record<string, unknown> = {}) {
    return this.renderTemplate(page, rendererRuntime, pageVariables);
  }
  });
};

export const renderThemePage = (page, runtime) => createThemeRenderer(runtime).renderThemePage(page, runtime);

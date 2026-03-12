export const CANONICAL_THEME_TEMPLATE_NAMES = Object.freeze([
  'homepage',
  'page',
  'post-list',
  'post-page',
  'not-found'
] as const);

export type CanonicalThemeTemplateName = typeof CANONICAL_THEME_TEMPLATE_NAMES[number];

/**
 * Legacy aliases are intentionally preserved for compatibility with older
 * integrations. New code should prefer canonical names.
 */
export const THEME_TEMPLATE_ALIASES = Object.freeze({
  index: 'homepage',
  home: 'homepage',
  blog: 'post-list',
  'blog-list': 'post-list',
  post: 'post-page',
  'blog-single': 'post-page'
} as const);

export type ThemeTemplateAlias = keyof typeof THEME_TEMPLATE_ALIASES;

export type ThemeTemplateName = CanonicalThemeTemplateName | ThemeTemplateAlias | string;

export type ThemeEntry = {
  title: string;
  slug: string;
  content: string;
  updatedAt: string;
  excerpt?: string;
};

/**
 * Context passed to public theme templates.
 *
 * This object is the contract theme authors should rely on.
 * New optional fields may be added over time, but existing keys should remain stable.
 */
export type ThemeTemplateContext = {
  siteName: string;
  siteTagline: string;
  homepageIntro: string;
  footerText: string;
  routePath: string;
  routeParams: Record<string, string>;
  pages: ThemeEntry[];
  posts: ThemeEntry[];
  post?: ThemeEntry;
  page?: ThemeEntry;
};

import {
  DEFAULT_PUBLIC_THEME_ID,
  getBuiltinPublicThemeRecord,
  resolvePublicThemeId,
  listBuiltinPublicThemes,
  type RegisteredPublicTheme
} from './theme-registry.ts';
import { CANONICAL_THEME_TEMPLATE_NAMES, type CanonicalThemeTemplateName } from './theme-contract.ts';

export type ThemeListItem = {
  id: string,
  title: string,
  source: RegisteredPublicTheme['source'],
  isDefault: boolean,
  templates: CanonicalThemeTemplateName[]
};

export type ThemeStatus = {
  configuredThemeId: string,
  resolvedThemeId: string,
  defaultThemeId: string,
  fallbackApplied: boolean,
  themes: ThemeListItem[]
};

const readConfiguredThemeId = (runtime): string => {
  const configuredThemeId = `${runtime?.settings?.getSettings?.()?.theme ?? ''}`.trim();
  return configuredThemeId || DEFAULT_PUBLIC_THEME_ID;
};

const listAvailableTemplates = (theme: RegisteredPublicTheme): CanonicalThemeTemplateName[] => CANONICAL_THEME_TEMPLATE_NAMES
  .filter((templateName) => typeof theme.templates?.[templateName] === 'function');

const toThemeListItem = (theme: RegisteredPublicTheme): ThemeListItem => Object.freeze({
  id: theme.id,
  title: theme.title,
  source: theme.source,
  isDefault: theme.isDefault,
  templates: Object.freeze(listAvailableTemplates(theme))
});

export const createThemeService = (runtime) => {
  const readThemes = () => listBuiltinPublicThemes().map((theme) => toThemeListItem(theme));

  const getConfiguredThemeId = () => readConfiguredThemeId(runtime);

  const getResolvedThemeId = () => resolvePublicThemeId(getConfiguredThemeId(), getBuiltinPublicThemeRecord());

  const getActive = () => Object.freeze({
    configuredThemeId: getConfiguredThemeId(),
    resolvedThemeId: getResolvedThemeId(),
    defaultThemeId: DEFAULT_PUBLIC_THEME_ID,
    fallbackApplied: getConfiguredThemeId() !== getResolvedThemeId()
  });

  const getStatus = (): ThemeStatus => {
    const active = getActive();

    return Object.freeze({
      configuredThemeId: active.configuredThemeId,
      resolvedThemeId: active.resolvedThemeId,
      defaultThemeId: active.defaultThemeId,
      fallbackApplied: active.fallbackApplied,
      themes: Object.freeze(readThemes())
    });
  };

  return Object.freeze({
    list: readThemes,
    getConfiguredThemeId,
    getResolvedThemeId,
    getActive,
    getStatus
  });
};

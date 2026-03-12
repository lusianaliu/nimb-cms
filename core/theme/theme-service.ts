import {
  DEFAULT_PUBLIC_THEME_ID,
  getBuiltinPublicThemeRecord,
  resolvePublicThemeId,
  listBuiltinPublicThemes,
  isRegisteredPublicThemeId,
  type RegisteredPublicTheme
} from './theme-registry.ts';
import { CANONICAL_THEME_TEMPLATE_NAMES, type CanonicalThemeTemplateName } from './theme-contract.ts';

export type ThemeListItem = {
  id: string,
  title: string,
  source: RegisteredPublicTheme['source'],
  isDefault: boolean,
  templates: CanonicalThemeTemplateName[],
  missingTemplates: CanonicalThemeTemplateName[],
  supportsAllCanonicalTemplates: boolean
};

export type ThemeStatus = {
  configuredThemeId: string,
  resolvedThemeId: string,
  defaultThemeId: string,
  fallbackApplied: boolean,
  themes: ThemeListItem[]
};

export class ThemeSelectionError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'ThemeSelectionError';
    this.code = code;
  }
}

const readConfiguredThemeId = (runtime): string => {
  const configuredThemeId = `${runtime?.settings?.getSettings?.()?.theme ?? ''}`.trim();
  return configuredThemeId || DEFAULT_PUBLIC_THEME_ID;
};

const listAvailableTemplates = (theme: RegisteredPublicTheme): CanonicalThemeTemplateName[] => CANONICAL_THEME_TEMPLATE_NAMES
  .filter((templateName) => typeof theme.templates?.[templateName] === 'function');

const listMissingTemplates = (availableTemplates: CanonicalThemeTemplateName[]): CanonicalThemeTemplateName[] => CANONICAL_THEME_TEMPLATE_NAMES
  .filter((templateName) => !availableTemplates.includes(templateName));

const toThemeListItem = (theme: RegisteredPublicTheme): ThemeListItem => {
  const templates = listAvailableTemplates(theme);
  const missingTemplates = listMissingTemplates(templates);

  return Object.freeze({
    id: theme.id,
    title: theme.title,
    source: theme.source,
    isDefault: theme.isDefault,
    templates: Object.freeze(templates),
    missingTemplates: Object.freeze(missingTemplates),
    supportsAllCanonicalTemplates: missingTemplates.length === 0
  });
};

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

  const setConfiguredThemeId = (input: unknown): ThemeStatus => {
    if (typeof input !== 'string') {
      throw new ThemeSelectionError('INVALID_THEME_ID', 'themeId must be a string.');
    }

    const themeId = input.trim();
    if (!themeId) {
      throw new ThemeSelectionError('THEME_ID_REQUIRED', 'themeId must not be blank.');
    }

    if (!isRegisteredPublicThemeId(themeId, getBuiltinPublicThemeRecord())) {
      throw new ThemeSelectionError('UNKNOWN_THEME_ID', `themeId "${themeId}" is not registered.`);
    }

    const configuredThemeId = getConfiguredThemeId();
    if (configuredThemeId === themeId) {
      return getStatus();
    }

    runtime?.settings?.updateSettings?.({ theme: themeId });
    return getStatus();
  };

  return Object.freeze({
    list: readThemes,
    getConfiguredThemeId,
    getResolvedThemeId,
    getActive,
    getStatus,
    setConfiguredThemeId
  });
};

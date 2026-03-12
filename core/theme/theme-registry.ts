import { defaultThemeTemplates } from '../../themes/default/index.ts';
import { sunriseThemeTemplates } from '../../themes/sunrise/index.ts';
import type { PublicThemeTemplateModule } from './theme-renderer.ts';

export const DEFAULT_PUBLIC_THEME_ID = 'default';

export type RegisteredPublicTheme = {
  id: string;
  title: string;
  source: 'builtin';
  templates: PublicThemeTemplateModule;
  isDefault: boolean;
};

const BUILTIN_THEME_DEFINITIONS: RegisteredPublicTheme[] = Object.freeze([
  {
    id: 'default',
    title: 'Default',
    source: 'builtin',
    templates: defaultThemeTemplates,
    isDefault: true
  },
  {
    id: 'sunrise',
    title: 'Sunrise',
    source: 'builtin',
    templates: sunriseThemeTemplates,
    isDefault: false
  }
]);

const toThemeRecord = (themes: RegisteredPublicTheme[]): Record<string, PublicThemeTemplateModule> => Object.freeze(
  Object.fromEntries(themes.map((theme) => [theme.id, theme.templates]))
);

export const listBuiltinPublicThemes = (): RegisteredPublicTheme[] => BUILTIN_THEME_DEFINITIONS;

export const getBuiltinPublicThemeRecord = (): Record<string, PublicThemeTemplateModule> => toThemeRecord(BUILTIN_THEME_DEFINITIONS);

export const resolvePublicThemeId = (themeId: string, availableThemes: Record<string, PublicThemeTemplateModule>): string => {
  const normalizedThemeId = `${themeId ?? ''}`.trim();
  if (normalizedThemeId && availableThemes[normalizedThemeId]) {
    return normalizedThemeId;
  }

  return DEFAULT_PUBLIC_THEME_ID;
};

export const isRegisteredPublicThemeId = (themeId: string, availableThemes: Record<string, PublicThemeTemplateModule>): boolean => {
  const normalizedThemeId = `${themeId ?? ''}`.trim();
  return normalizedThemeId !== '' && Object.prototype.hasOwnProperty.call(availableThemes, normalizedThemeId);
};

export const getDefaultPublicThemeTemplates = (): PublicThemeTemplateModule => defaultThemeTemplates;

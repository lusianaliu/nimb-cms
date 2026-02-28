import type { ThemeVariables } from './admin-theme-registry.ts';

export const ADMIN_THEME_VARIABLES_STYLE_ID = 'admin-theme-vars';

const DEFAULT_THEME_VARIABLES = Object.freeze({
  colors: Object.freeze({
    primary: '#4f46e5',
    background: '#f9fafb',
    surface: '#ffffff',
    text: '#111827'
  })
});

const toCssVariableBlock = (variables: ReturnType<typeof normalizeThemeVariables>) => `:root {
  --nimb-color-primary: ${variables.colors.primary};
  --nimb-color-background: ${variables.colors.background};
  --nimb-color-surface: ${variables.colors.surface};
  --nimb-color-text: ${variables.colors.text};
}`;

const normalizeThemeVariables = (variables?: ThemeVariables) => {
  const colors = variables?.colors ?? {};

  return Object.freeze({
    colors: Object.freeze({
      primary: String(colors.primary ?? '').trim() || DEFAULT_THEME_VARIABLES.colors.primary,
      background: String(colors.background ?? '').trim() || DEFAULT_THEME_VARIABLES.colors.background,
      surface: String(colors.surface ?? '').trim() || DEFAULT_THEME_VARIABLES.colors.surface,
      text: String(colors.text ?? '').trim() || DEFAULT_THEME_VARIABLES.colors.text
    })
  });
};

export const applyThemeVariables = ({ document, variables }: { document: Document; variables?: ThemeVariables }) => {
  if (!document) {
    return normalizeThemeVariables(variables);
  }

  const resolvedVariables = normalizeThemeVariables(variables);
  const cssText = toCssVariableBlock(resolvedVariables);

  const existingStyle = document.getElementById(ADMIN_THEME_VARIABLES_STYLE_ID);
  if (existingStyle) {
    existingStyle.textContent = cssText;
    return resolvedVariables;
  }

  const style = document.createElement('style');
  style.id = ADMIN_THEME_VARIABLES_STYLE_ID;
  style.textContent = cssText;

  const head = document.head ?? document.getElementsByTagName('head')?.[0] ?? document.documentElement;
  head?.append(style);

  return resolvedVariables;
};

export const getDefaultThemeVariables = () => DEFAULT_THEME_VARIABLES;

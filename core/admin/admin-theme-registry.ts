export interface AdminTheme {
  id: string
  name: string
  apply(context: {
    document: Document
    slots: Record<string, HTMLElement>
  }): void
}

const DEFAULT_ADMIN_THEME_ID = 'default';
const adminThemes = new Map<string, AdminTheme>();

const fallbackTheme: AdminTheme = Object.freeze({
  id: DEFAULT_ADMIN_THEME_ID,
  name: 'Default Admin Theme',
  apply() {
    // no-op fallback for safe runtime behavior.
  }
});

const normalizeTheme = (theme: AdminTheme): AdminTheme => {
  const id = String(theme?.id ?? '').trim();
  const name = String(theme?.name ?? '').trim();

  if (!id || !name || typeof theme?.apply !== 'function') {
    throw new TypeError('Admin theme must include id, name, and apply(context)');
  }

  return Object.freeze({
    id,
    name,
    apply: theme.apply
  });
};

export const registerAdminTheme = (theme: AdminTheme) => {
  const normalizedTheme = normalizeTheme(theme);

  if (adminThemes.has(normalizedTheme.id)) {
    throw new Error(`Admin theme already registered: ${normalizedTheme.id}`);
  }

  adminThemes.set(normalizedTheme.id, normalizedTheme);
  return normalizedTheme;
};

export const getDefaultAdminTheme = () => adminThemes.get(DEFAULT_ADMIN_THEME_ID) ?? fallbackTheme;

export const getAdminTheme = (id: string) => {
  const themeId = String(id ?? '').trim();

  if (!themeId) {
    return getDefaultAdminTheme();
  }

  return adminThemes.get(themeId) ?? getDefaultAdminTheme();
};

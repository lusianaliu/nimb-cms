const DEFAULT_ADMIN_BRANDING = Object.freeze({
  adminTitle: 'Nimb Admin',
  logoText: 'Nimb',
  logoUrl: ''
});

const normalizeBranding = (branding) => {
  const candidate = branding ?? {};

  const adminTitle = String(candidate?.adminTitle ?? '').trim() || DEFAULT_ADMIN_BRANDING.adminTitle;
  const logoText = String(candidate?.logoText ?? '').trim() || DEFAULT_ADMIN_BRANDING.logoText;
  const logoUrl = String(candidate?.logoUrl ?? '').trim();

  return Object.freeze({
    adminTitle,
    logoText,
    logoUrl
  });
};

export const getDefaultAdminBranding = () => DEFAULT_ADMIN_BRANDING;

export const applyAdminBranding = ({ document, branding, slots }) => {
  const resolvedBranding = normalizeBranding(branding);

  if (document && 'title' in document) {
    document.title = resolvedBranding.adminTitle;
  }

  const headerSlot = slots?.header;
  if (!headerSlot || typeof headerSlot.querySelector !== 'function') {
    return resolvedBranding;
  }

  const brandNode = headerSlot.querySelector('#admin-brand');
  if (!brandNode || typeof brandNode.replaceChildren !== 'function') {
    return resolvedBranding;
  }

  const brandElement = document.createElement('span');
  brandElement.textContent = resolvedBranding.logoText;

  if (resolvedBranding.logoUrl) {
    const logoImage = document.createElement('img');
    logoImage.setAttribute('src', resolvedBranding.logoUrl);
    logoImage.setAttribute('alt', resolvedBranding.logoText);
    brandNode.replaceChildren(logoImage);
  } else {
    brandNode.replaceChildren(brandElement);
  }

  return resolvedBranding;
};

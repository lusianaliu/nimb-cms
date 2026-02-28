const renderNavigation = async () => {
  const app = document.getElementById('app');

  if (!app) {
    return;
  }

  try {
    const response = await fetch('/admin-api/pages');
    if (!response.ok) {
      throw new Error(`Failed to load admin pages: ${response.status}`);
    }

    const pages = await response.json();
    const titles = Array.isArray(pages)
      ? pages.map((page) => `- ${page.title}`)
      : [];

    app.innerHTML = [
      'Nimb Admin',
      '-----------',
      ...titles
    ].join('<br>');
  } catch {
    app.innerHTML = [
      'Nimb Admin',
      '-----------',
      'Navigation unavailable.'
    ].join('<br>');
  }
};

void renderNavigation();

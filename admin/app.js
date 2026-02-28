const renderSystemPanel = async () => {
  const app = document.getElementById('app');

  if (!app) {
    return;
  }

  try {
    const response = await fetch('/admin-api/system');
    if (!response.ok) {
      throw new Error(`Failed to load system info: ${response.status}`);
    }

    const system = await response.json();
    app.innerHTML = [
      'Nimb Admin',
      '-----------',
      `Name: ${system.name}`,
      `Version: ${system.version}`,
      `Mode: ${system.mode}`,
      `Installed: ${system.installed}`
    ].join('<br>');
  } catch (error) {
    app.innerHTML = [
      'Nimb Admin',
      '-----------',
      'System status unavailable.'
    ].join('<br>');
  }
};

void renderSystemPanel();

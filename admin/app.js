const createListElement = (items) => {
  const list = document.createElement('ul');

  items.forEach((item) => {
    const listItem = document.createElement('li');
    listItem.textContent = item;
    list.append(listItem);
  });

  return list;
};

const createSystemInfoElement = (system) => {
  const container = document.createElement('section');

  const lines = [
    `Name: ${system.name ?? 'Unknown'}`,
    `Version: ${system.version ?? 'Unknown'}`,
    `Mode: ${system.mode ?? 'Unknown'}`,
    `Installed: ${system.installed === true ? 'Yes' : 'No'}`
  ];

  container.innerHTML = lines.join('<br>');
  return container;
};

const bootstrapLayout = () => {
  const slots = {
    header: document.getElementById('admin-header'),
    sidebar: document.getElementById('admin-sidebar'),
    main: document.getElementById('admin-main'),
    footer: document.getElementById('admin-footer')
  };

  window.NimbAdmin = {
    slots
  };

  const setSlot = (name, element) => {
    const slot = window.NimbAdmin?.slots?.[name];

    if (!slot) {
      return;
    }

    slot.replaceChildren();
    if (element) {
      slot.append(element);
    }
  };

  const clearSlot = (name) => {
    const slot = window.NimbAdmin?.slots?.[name];

    if (!slot) {
      return;
    }

    slot.replaceChildren();
  };

  window.NimbAdmin.setSlot = setSlot;
  window.NimbAdmin.clearSlot = clearSlot;

  const header = document.createElement('strong');
  header.textContent = 'Nimb Admin';
  setSlot('header', header);

  setSlot('sidebar', createListElement(['System']));

  const footer = document.createElement('small');
  footer.textContent = 'Nimb CMS Runtime';
  setSlot('footer', footer);

  const systemFallback = document.createElement('p');
  systemFallback.textContent = 'System information unavailable.';
  setSlot('main', systemFallback);

  void fetch('/admin-api/system')
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Failed to load system info: ${response.status}`);
      }

      return response.json();
    })
    .then((system) => {
      setSlot('main', createSystemInfoElement(system));
    })
    .catch(() => {
      // Leave fallback content in place.
    });
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrapLayout, { once: true });
} else {
  bootstrapLayout();
}

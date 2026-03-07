(function () {
  const resolveEditor = () => (typeof window !== 'undefined' ? window.tinymce : null);

  const escapeHtml = (value) => `${value ?? ''}`
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

  const insertImage = (url) => {
    const source = `${url ?? ''}`.trim();
    if (!source) {
      return;
    }

    const editor = resolveEditor();
    if (!editor || typeof editor.get !== 'function') {
      return;
    }

    const activeEditor = editor.get('body');
    if (!activeEditor || typeof activeEditor.insertContent !== 'function') {
      return;
    }

    activeEditor.insertContent(`<img src="${escapeHtml(source)}" alt="" />`);
  };

  const initEditor = (selector) => {
    const tinyMce = resolveEditor();
    if (!tinyMce || typeof tinyMce.init !== 'function') {
      return;
    }

    tinyMce.init({
      selector,
      menubar: false,
      plugins: 'link lists image code',
      toolbar: 'bold italic underline | link bullist numlist | image nimbinsertimage | code',
      setup(editor) {
        if (!editor?.ui?.registry?.addButton) {
          return;
        }

        editor.ui.registry.addButton('nimbinsertimage', {
          text: 'Insert Image',
          onAction() {
            if (editor?.windowManager?.openUrl) {
              editor.windowManager.openUrl({
                title: 'Media Library',
                url: '/admin/media',
                width: 960,
                height: 640
              });
              return;
            }

            const selectedUrl = window.prompt('Image URL');
            insertImage(selectedUrl);
          }
        });
      }
    });

    document.querySelector(selector)?.closest('form')?.addEventListener('submit', () => {
      if (typeof tinyMce.triggerSave === 'function') {
        tinyMce.triggerSave();
      }
    });
  };

  window.initEditor = initEditor;
  window.insertImage = insertImage;

  window.addEventListener('message', (event) => {
    const message = event?.data;
    if (!message || message.type !== 'nimb:media-selected') {
      return;
    }

    insertImage(message.url);
  });
})();

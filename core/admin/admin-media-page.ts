const escapeHtml = (value: unknown) => `${value ?? ''}`
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

export const renderAdminMediaPage = () => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Media · Nimb CMS Admin</title>
    <style>
      body { font-family: sans-serif; margin: 2rem; }
      .media-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 1rem; margin-top: 1.5rem; }
      .media-card { border: 1px solid #ddd; padding: 0.75rem; border-radius: 8px; }
      .media-card img { width: 100%; height: 120px; object-fit: cover; background: #f4f4f4; border-radius: 4px; }
      .media-url { font-size: 0.85rem; margin: 0.5rem 0; word-break: break-all; }
    </style>
  </head>
  <body>
    <h1>Media Library</h1>
    <p><a href="/admin">Back to dashboard</a></p>

    <form id="media-upload-form" enctype="multipart/form-data">
      <label for="media-file">Upload image</label><br>
      <input id="media-file" name="file" type="file" accept="image/jpeg,image/png,image/webp,image/gif" required>
      <button type="submit">Upload</button>
    </form>

    <div id="media-grid" class="media-grid"></div>

    <script>
      function insertImage(url) {
        const payload = { type: 'nimb:media-selected', url };

        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(payload, window.location.origin);
          window.close();
          return;
        }

        if (window.parent && window.parent !== window) {
          window.parent.postMessage(payload, window.location.origin);
        }
      }

      const escapeHtml = (value) => String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');

      const renderMedia = (files) => {
        const grid = document.getElementById('media-grid');

        if (!Array.isArray(files) || files.length === 0) {
          grid.innerHTML = '<p>No media uploaded yet.</p>';
          return;
        }

        grid.innerHTML = files.map((item) => {
          const url = item?.url ?? '';
          const safeUrl = escapeHtml(url);

          return '<article class="media-card">'
            + '<img src="' + safeUrl + '" alt="">'
            + '<p class="media-url">' + safeUrl + '</p>'
            + '<button type="button" data-url="' + safeUrl + '">Copy URL</button> '
            + '<button type="button" data-insert="' + safeUrl + '">Insert</button>'
            + '</article>';
        }).join('');

        grid.querySelectorAll('[data-url]').forEach((button) => {
          button.addEventListener('click', () => {
            const url = button.getAttribute('data-url') || '';
            navigator.clipboard?.writeText(url);
          });
        });

        grid.querySelectorAll('[data-insert]').forEach((button) => {
          button.addEventListener('click', () => {
            const url = button.getAttribute('data-insert') || '';
            insertImage(url);
          });
        });
      };

      const loadMedia = async () => {
        const response = await fetch('/admin-api/media/list');
        const payload = await response.json();
        renderMedia(payload?.files ?? []);
      };

      document.getElementById('media-upload-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const body = new FormData(form);

        const response = await fetch('/admin-api/media/upload', { method: 'POST', body });
        if (!response.ok) {
          alert('Upload failed');
          return;
        }

        await loadMedia();
        form.reset();
      });

      void loadMedia();
    </script>
  </body>
</html>`;

export const adminMediaPageIntent = escapeHtml('Simple media library shell for local uploads and URL reuse.');

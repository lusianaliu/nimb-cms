import { renderAdminShell } from './admin-shell.ts';

const escapeHtml = (value: unknown) => `${value ?? ''}`
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

export const renderAdminMediaPage = (runtime) => renderAdminShell({
  title: 'Media · Nimb CMS Admin',
  runtime,
  activeNav: 'media',
  pageTitle: 'Media',
  pageDescription: 'Upload images and reuse links in your pages and posts.',
  content: `<form id="media-upload-form" enctype="multipart/form-data">
      <div>
        <label for="media-file">Upload image</label>
        <input id="media-file" name="file" type="file" accept="image/jpeg,image/png,image/webp,image/gif" required>
      </div>
      <button type="submit">Upload</button>
      <p id="media-status" class="muted" aria-live="polite"></p>
    </form>
    <div id="media-grid" class="admin-card-grid"></div>

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

      const setStatus = (text) => {
        const target = document.getElementById('media-status');
        if (target) {
          target.textContent = text;
        }
      };

      const renderMedia = (files) => {
        const grid = document.getElementById('media-grid');

        if (!Array.isArray(files) || files.length === 0) {
          grid.innerHTML = '<p class="muted">No media uploaded yet.</p>';
          return;
        }

        grid.innerHTML = files.map((item) => {
          const url = item?.url ?? '';
          const safeUrl = escapeHtml(url);

          return '<article class="admin-surface">'
            + '<img src="' + safeUrl + '" alt="" style="width:100%;height:140px;object-fit:cover;background:#f1f5f9;border-radius:6px">'
            + '<p><small>' + safeUrl + '</small></p>'
            + '<button type="button" data-url="' + safeUrl + '">Copy URL</button> '
            + '<button type="button" data-insert="' + safeUrl + '">Insert</button>'
            + '</article>';
        }).join('');

        grid.querySelectorAll('[data-url]').forEach((button) => {
          button.addEventListener('click', () => {
            const url = button.getAttribute('data-url') || '';
            navigator.clipboard?.writeText(url);
            setStatus('Media URL copied.');
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

        setStatus('Uploading...');
        const response = await fetch('/admin-api/media/upload', { method: 'POST', body });
        if (!response.ok) {
          setStatus('Upload failed. Please try again.');
          return;
        }

        await loadMedia();
        form.reset();
        setStatus('Upload complete.');
      });

      void loadMedia();
    </script>`
});

export const adminMediaPageIntent = escapeHtml('Simple media library shell for local uploads and URL reuse.');

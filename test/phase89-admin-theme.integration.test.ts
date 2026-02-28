import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { registerAdminTheme, getDefaultAdminTheme, getAdminTheme } from '../core/admin/admin-theme-registry.ts';
import { createDefaultAdminTheme } from '../core/admin/themes/default-theme.ts';

class FakeElement {
  tagName: string;
  id = '';
  children: FakeElement[] = [];
  parent: FakeElement | null = null;
  textContent = '';
  innerHTML = '';
  style: Record<string, string> = {};
  attributes = new Map<string, string>();
  listeners = new Map<string, Array<() => void>>();

  constructor(tagName: string) {
    this.tagName = tagName.toLowerCase();
  }

  append(...nodes: FakeElement[]) {
    for (const node of nodes) {
      node.parent = this;
      this.children.push(node);
    }
  }

  replaceChildren(...nodes: FakeElement[]) {
    this.children = [];
    this.innerHTML = '';
    this.textContent = '';
    this.append(...nodes);
  }

  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }

  getAttribute(name: string) {
    return this.attributes.get(name) ?? null;
  }

  removeAttribute(name: string) {
    this.attributes.delete(name);
  }

  addEventListener(type: string, listener: () => void) {
    const current = this.listeners.get(type) ?? [];
    current.push(listener);
    this.listeners.set(type, current);
  }

  querySelectorAll(selector: string): FakeElement[] {
    if (selector !== 'li[data-page]') {
      return [];
    }

    const nodes: FakeElement[] = [];
    const walk = (element: FakeElement) => {
      for (const child of element.children) {
        if (child.tagName === 'li' && child.attributes.has('data-page')) {
          nodes.push(child);
        }

        walk(child);
      }
    };

    walk(this);
    return nodes;
  }
}

class FakeDocument {
  readyState = 'complete';
  nodesById: Record<string, FakeElement>;
  head: FakeElement;

  constructor(nodesById: Record<string, FakeElement>) {
    this.nodesById = nodesById;
    this.head = new FakeElement('head');
  }

  createElement(tagName: string) {
    return new FakeElement(tagName);
  }

  getElementById(id: string) {
    if (id === 'nimb-admin-theme-default') {
      return this.head.children.find((child) => child.id === id) ?? null;
    }

    return this.nodesById[id] ?? null;
  }

  addEventListener() {
    // No-op because test uses readyState: complete.
  }
}

const flushMicrotasks = async () => {
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
};

test('phase 89: admin theme engine registers themes and applies default runtime theme', async () => {
  const appScript = fs.readFileSync(new URL('../admin/app.js', import.meta.url), 'utf8');

  const uniqueThemeId = `phase89-${Date.now()}`;
  const registeredTheme = registerAdminTheme({
    id: uniqueThemeId,
    name: 'Phase 89 Test Theme',
    apply() {
      // no-op for registry validation.
    }
  });

  assert.equal(registeredTheme.id, uniqueThemeId);
  assert.equal(getAdminTheme(uniqueThemeId).name, 'Phase 89 Test Theme');
  assert.equal(getDefaultAdminTheme().id, 'default');

  const defaultTheme = createDefaultAdminTheme();
  assert.equal(defaultTheme.id, 'default');

  const header = new FakeElement('header');
  const sidebar = new FakeElement('aside');
  const main = new FakeElement('main');
  const footer = new FakeElement('footer');

  const document = new FakeDocument({
    'admin-header': header,
    'admin-sidebar': sidebar,
    'admin-main': main,
    'admin-footer': footer
  });

  const pages = [{ id: 'system', title: 'System', path: '/admin' }];
  const location = { pathname: '/admin/system' };

  const context = {
    document,
    window: {},
    location,
    history: {
      pushState: (_state: Record<string, never>, _title: string, url: string) => {
        location.pathname = url;
      }
    },
    addEventListener: () => {
      // no-op
    },
    fetch: async (url: string) => {
      if (url === '/admin-api/system') {
        return {
          ok: true,
          json: async () => ({ name: 'Nimb', version: '89.0.0', mode: 'runtime', installed: true, adminTheme: 'default' })
        };
      }

      if (url === '/admin-api/pages') {
        return {
          ok: true,
          json: async () => pages
        };
      }

      throw new Error(`Unexpected fetch URL: ${url}`);
    }
  } as {
    document: FakeDocument;
    window: Record<string, unknown>;
    location: { pathname: string };
    history: { pushState: (_state: Record<string, never>, _title: string, url: string) => void };
    addEventListener: () => void;
    fetch: (url: string) => Promise<{ ok: boolean; json: () => Promise<unknown> }>;
  };

  context.window = context as unknown as Record<string, unknown>;
  vm.runInNewContext(appScript, context);

  await flushMicrotasks();
  await flushMicrotasks();

  const injectedStyle = document.head.children.find((node) => node.id === 'nimb-admin-theme-default');
  assert.equal(Boolean(injectedStyle), true);
  assert.equal(String(injectedStyle?.textContent ?? '').includes('#admin-root'), true);

  assert.equal((context.window as { NimbAdmin: { slots: Record<string, FakeElement | null> } }).NimbAdmin.slots.main, main);
  assert.equal(main.children[0].tagName, 'section');
  assert.equal(sidebar.children[0].id, 'admin-nav');
});

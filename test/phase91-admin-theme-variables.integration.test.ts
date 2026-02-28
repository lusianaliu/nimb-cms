import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { applyThemeVariables, getDefaultThemeVariables } from '../core/admin/theme-variables.ts';

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

  querySelector(selector: string): FakeElement | null {
    if (selector !== '#admin-brand') {
      return null;
    }

    const walk = (element: FakeElement): FakeElement | null => {
      for (const child of element.children) {
        if (child.id === 'admin-brand') {
          return child;
        }

        const nested = walk(child);
        if (nested) {
          return nested;
        }
      }

      return null;
    };

    return walk(this);
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
  title = 'Initial';
  nodesById: Record<string, FakeElement>;
  head: FakeElement;
  documentElement: FakeElement;

  constructor(nodesById: Record<string, FakeElement>) {
    this.nodesById = nodesById;
    this.head = new FakeElement('head');
    this.documentElement = new FakeElement('html');
  }

  createElement(tagName: string) {
    return new FakeElement(tagName);
  }

  getElementById(id: string) {
    const inHead = this.head.children.find((child) => child.id === id);
    if (inHead) {
      return inHead;
    }

    return this.nodesById[id] ?? null;
  }

  getElementsByTagName(tagName: string) {
    if (tagName === 'head') {
      return [this.head];
    }

    return [];
  }

  addEventListener() {
    // no-op
  }
}

const flushMicrotasks = async () => {
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
};

test('phase 91: applyThemeVariables injects CSS variables and replaces prior values', () => {
  const document = new FakeDocument({});

  const defaults = getDefaultThemeVariables();
  applyThemeVariables({ document: document as unknown as Document, variables: defaults });

  const initial = document.getElementById('admin-theme-vars');
  assert.equal(Boolean(initial), true);
  assert.equal(String(initial?.textContent ?? '').includes('--nimb-color-primary: #4f46e5;'), true);
  assert.equal(String(initial?.textContent ?? '').includes('--nimb-color-text: #111827;'), true);

  applyThemeVariables({
    document: document as unknown as Document,
    variables: {
      colors: {
        primary: '#0f172a',
        text: '#f9fafb'
      }
    }
  });

  const replaced = document.getElementById('admin-theme-vars');
  assert.equal(document.head.children.filter((child) => child.id === 'admin-theme-vars').length, 1);
  assert.equal(String(replaced?.textContent ?? '').includes('--nimb-color-primary: #0f172a;'), true);
  assert.equal(String(replaced?.textContent ?? '').includes('--nimb-color-background: #f9fafb;'), true);
  assert.equal(String(replaced?.textContent ?? '').includes('--nimb-color-text: #f9fafb;'), true);
});

test('phase 91: admin boot still succeeds when selected theme has no variables', async () => {
  const appScript = fs.readFileSync(new URL('../admin/app.js', import.meta.url), 'utf8');

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
          json: async () => ({
            name: 'Nimb',
            version: '91.0.0',
            mode: 'runtime',
            installed: true,
            adminTheme: 'plain',
            adminBranding: {
              adminTitle: 'Phase 91 Admin',
              logoText: 'Theme 91'
            }
          })
        };
      }

      if (url === '/admin-api/pages') {
        return {
          ok: true,
          json: async () => [{ id: 'system', title: 'System', path: '/admin/system' }]
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

  (context.window as {
    NimbAdmin: {
      themes: {
        register: (theme: { id: string; name: string; apply: (value: { document: FakeDocument }) => void }) => void;
      };
    };
  }).NimbAdmin.themes.register({
    id: 'plain',
    name: 'Plain Theme',
    apply: ({ document: activeDocument }) => {
      const style = activeDocument.createElement('style');
      style.id = 'plain-theme';
      style.textContent = '#admin-root { min-height: 100vh; }';
      activeDocument.head.append(style);
    }
  });

  await flushMicrotasks();
  await flushMicrotasks();

  const varsStyle = document.getElementById('admin-theme-vars');
  assert.equal(Boolean(varsStyle), true);
  assert.equal(String(varsStyle?.textContent ?? '').includes('--nimb-color-primary: #4f46e5;'), true);
  assert.equal(document.title, 'Phase 91 Admin');
  assert.equal(header.querySelector('#admin-brand')?.children[0].textContent, 'Theme 91');
  assert.equal(sidebar.children[0].id, 'admin-nav');
});

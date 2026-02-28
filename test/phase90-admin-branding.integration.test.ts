import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

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
    // no-op
  }
}

const flushMicrotasks = async () => {
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
};

const createAppContext = (systemPayload: Record<string, unknown>) => {
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
        return { ok: true, json: async () => systemPayload };
      }

      if (url === '/admin-api/pages') {
        return { ok: true, json: async () => [{ id: 'system', title: 'System', path: '/admin/system' }] };
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

  return { context, document, header, sidebar, main };
};

test('phase 90: admin branding applies custom title and logo text after theme', async () => {
  const { document, header, sidebar } = createAppContext({
    name: 'Nimb',
    version: '90.0.0',
    mode: 'runtime',
    installed: true,
    adminTheme: 'default',
    adminBranding: {
      adminTitle: 'Acme Admin',
      logoText: 'Acme'
    }
  });

  await flushMicrotasks();
  await flushMicrotasks();

  assert.equal(document.title, 'Acme Admin');
  assert.equal(header.querySelector('#admin-brand')?.children[0].textContent, 'Acme');
  assert.equal(sidebar.children[0].id, 'admin-nav');
  assert.equal(document.head.children.some((node) => node.id === 'nimb-admin-theme-default'), true);
});

test('phase 90: missing branding payload falls back to defaults without breaking admin boot', async () => {
  const { document, header, main } = createAppContext({
    name: 'Nimb',
    version: '90.0.0',
    mode: 'runtime',
    installed: true,
    adminTheme: 'default'
  });

  await flushMicrotasks();
  await flushMicrotasks();

  assert.equal(document.title, 'Nimb Admin');
  assert.equal(header.querySelector('#admin-brand')?.children[0].textContent, 'Nimb');
  assert.equal(main.children[0].tagName, 'section');
});

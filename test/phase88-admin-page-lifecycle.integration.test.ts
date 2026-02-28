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

  click() {
    for (const listener of this.listeners.get('click') ?? []) {
      listener();
    }
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

  constructor(nodesById: Record<string, FakeElement>) {
    this.nodesById = nodesById;
  }

  createElement(tagName: string) {
    return new FakeElement(tagName);
  }

  getElementById(id: string) {
    return this.nodesById[id] ?? null;
  }

  addEventListener() {
    // No-op for tests because we use readyState: complete.
  }
}

const flushMicrotasks = async () => {
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
};

test('phase 88: admin page lifecycle mounts and unmounts in navigation order', async () => {
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

  const lifecycleEvents: string[] = [];
  const pages = [
    {
      id: 'system',
      title: 'System',
      path: '/admin/system',
      render: (context: { slots: { main: FakeElement } }) => {
        lifecycleEvents.push('system:render');
        const element = new FakeElement('section');
        element.textContent = `system:${String(Boolean(context.slots.main))}`;
        return element;
      },
      onMount: (context: { page: { id: string } }) => {
        lifecycleEvents.push(`system:mount:${context.page.id}`);
      },
      onUnmount: (context: { page: { id: string } }) => {
        lifecycleEvents.push(`system:unmount:${context.page.id}`);
      }
    },
    {
      id: 'settings',
      title: 'Settings',
      path: '/admin/settings',
      render: () => {
        lifecycleEvents.push('settings:render');
        const element = new FakeElement('section');
        element.textContent = 'settings';
        return element;
      },
      onMount: (context: { router: { navigate: (pageId: string) => void } }) => {
        lifecycleEvents.push(`settings:mount:${typeof context.router.navigate}`);
      },
      onUnmount: () => {
        lifecycleEvents.push('settings:unmount');
      }
    },
    {
      id: 'help',
      title: 'Help',
      path: '/admin/help'
    }
  ];

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
      if (url === '/admin-api/pages') {
        return { ok: true, json: async () => pages };
      }

      if (url === '/admin-api/system') {
        return {
          ok: true,
          json: async () => ({ name: 'Nimb', version: '88.0.0', mode: 'development', installed: true })
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

  assert.deepEqual(lifecycleEvents, ['system:render', 'system:mount:system']);
  lifecycleEvents.length = 0;

  (context.window as { NimbAdmin: { router: { navigate: (pageId: string) => void } } }).NimbAdmin.router.navigate('settings');

  assert.deepEqual(lifecycleEvents, [
    'system:unmount:system',
    'settings:render',
    'settings:mount:function'
  ]);

  lifecycleEvents.length = 0;

  (context.window as { NimbAdmin: { router: { navigate: (pageId: string) => void } } }).NimbAdmin.router.navigate('help');

  assert.deepEqual(lifecycleEvents, ['settings:unmount']);
  assert.equal(main.children[0].children[0].textContent, 'Help');
  assert.equal(main.children[0].children[1].textContent, 'Admin page: help');
});

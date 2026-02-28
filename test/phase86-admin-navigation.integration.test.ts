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

test('phase 86: admin navigation renders registry pages and updates main content on click', async () => {
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

  const pages = [
    { id: 'system', title: 'System', path: '/admin' },
    { id: 'content', title: 'Content', path: '/admin/content' }
  ];

  const fetchCalls: string[] = [];
  const context = {
    document,
    window: {},
    fetch: async (url: string) => {
      fetchCalls.push(url);
      if (url === '/admin-api/pages') {
        return { ok: true, json: async () => pages };
      }

      if (url === '/admin-api/system') {
        return {
          ok: true,
          json: async () => ({ name: 'Nimb', version: '86.0.0', mode: 'development', installed: true })
        };
      }

      throw new Error(`Unexpected fetch URL: ${url}`);
    }
  } as { document: FakeDocument; window: Record<string, unknown>; fetch: (url: string) => Promise<{ ok: boolean; json: () => Promise<unknown> }> };

  context.window = context as unknown as Record<string, unknown>;
  vm.runInNewContext(appScript, context);
  await flushMicrotasks();
  await flushMicrotasks();

  const navList = sidebar.children[0];
  assert.equal(navList.id, 'admin-nav');
  const navItems = navList.querySelectorAll('li[data-page]');
  assert.equal(navItems.length, 2);
  assert.equal(navItems[0].textContent, 'System');
  assert.equal(navItems[1].textContent, 'Content');
  assert.equal(fetchCalls.includes('/admin-api/pages'), true);

  await flushMicrotasks();
  assert.equal(fetchCalls.includes('/admin-api/system'), true);
  assert.equal(main.children.length, 1);
  assert.equal(main.children[0].innerHTML.includes('Name: Nimb'), true);

  navItems[1].click();
  assert.equal(navItems[1].getAttribute('data-active'), 'true');
  assert.equal(navItems[0].getAttribute('data-active'), null);
  assert.equal(main.children.length, 1);
  assert.equal(main.children[0].children[0].tagName, 'h2');
  assert.equal(main.children[0].children[0].textContent, 'Content');
  assert.equal(main.children[0].children[1].textContent, 'Admin page: content');
});

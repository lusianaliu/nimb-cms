import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createTestServer } from './helpers/create-test-server.ts';

const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase171-'));

const writeConfig = (cwd: string) => {
  fs.writeFileSync(path.join(cwd, 'nimb.config.json'), `${JSON.stringify({
    name: 'nimb-app',
    plugins: [],
    runtime: { logLevel: 'info', mode: 'development' }
  }, null, 2)}\n`);
};

const writeInstallState = (cwd: string) => {
  const systemDir = path.join(cwd, 'data', 'system');
  fs.mkdirSync(systemDir, { recursive: true });
  fs.writeFileSync(path.join(systemDir, 'config.json'), `${JSON.stringify({
    installed: true,
    version: '171.0.0',
    installedAt: '2026-01-01T00:00:00.000Z'
  }, null, 2)}\n`);
  fs.writeFileSync(path.join(cwd, 'data', 'install.lock'), 'installed\n');
};

const installContactPlugin = (cwd: string) => {
  const sourceDir = path.resolve(process.cwd(), 'plugins', 'contact-form');
  const targetDir = path.join(cwd, 'plugins', 'contact-form');
  fs.mkdirSync(path.dirname(targetDir), { recursive: true });
  fs.cpSync(sourceDir, targetDir, { recursive: true });
};

const submitContact = (port: number, payload: Record<string, string>) => {
  const form = new URLSearchParams(payload);
  return fetch(`http://127.0.0.1:${port}/contact`, {
    method: 'POST',
    redirect: 'manual',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form.toString()
  });
};

test('phase 171: contact form plugin loads and serves public form plus validation errors', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd);
  writeInstallState(cwd);
  installContactPlugin(cwd);

  const started = await createTestServer({ cwd });
  const listening = await started.server.start();

  try {
    const formResponse = await fetch(`http://127.0.0.1:${listening.port}/contact`);
    assert.equal(formResponse.status, 200);

    const formHtml = await formResponse.text();
    assert.equal(formHtml.includes('Contact Us'), true);
    assert.equal(formHtml.includes('name="email"'), true);
    assert.equal(formHtml.includes('name="message"'), true);

    const invalidResponse = await submitContact(listening.port, {
      name: '',
      email: 'not-an-email',
      subject: 'Hello',
      message: '',
      website: ''
    });

    assert.equal(invalidResponse.status, 400);
    const invalidHtml = await invalidResponse.text();
    assert.equal(invalidHtml.includes('Name is required.'), true);
    assert.equal(invalidHtml.includes('Email format is invalid.'), true);
    assert.equal(invalidHtml.includes('Message is required.'), true);

    const records = started.runtime.db.query('contact-submission', {});
    assert.equal(records.length, 0);
  } finally {
    await started.server.stop();
  }
});

test('phase 171: contact form plugin stores submissions, exposes admin APIs, and marks read', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd);
  writeInstallState(cwd);
  installContactPlugin(cwd);

  const started = await createTestServer({ cwd });
  const listening = await started.server.start();

  try {
    const firstSubmit = await submitContact(listening.port, {
      name: 'Jane Sender',
      email: 'jane@example.com',
      subject: 'Inquiry',
      message: 'Can you share your service brochure?',
      website: ''
    });

    assert.equal(firstSubmit.status, 302);
    assert.equal(firstSubmit.headers.get('location'), '/contact?success=1');

    const entries = started.runtime.db.query('contact-submission', { sort: 'id desc' });
    assert.equal(entries.length, 1);
    assert.equal(entries[0]?.data?.status, 'new');

    const listResponse = await fetch(`http://127.0.0.1:${listening.port}/admin-api/contact-form/submissions`);
    assert.equal(listResponse.status, 200);

    const listBody = await listResponse.json();
    assert.equal(Array.isArray(listBody), true);
    assert.equal(listBody.length, 1);
    assert.equal(listBody[0].name, 'Jane Sender');

    const detailResponse = await fetch(`http://127.0.0.1:${listening.port}/admin-api/contact-form/submissions/${entries[0].id}`);
    assert.equal(detailResponse.status, 200);

    const detailBody = await detailResponse.json();
    assert.equal(detailBody.message, 'Can you share your service brochure?');
    assert.equal(detailBody.status, 'new');

    const markReadResponse = await fetch(`http://127.0.0.1:${listening.port}/admin-api/contact-form/submissions/${entries[0].id}/read`, {
      method: 'POST'
    });
    assert.equal(markReadResponse.status, 200);

    const updated = started.runtime.db.get('contact-submission', entries[0].id);
    assert.equal(updated?.data?.status, 'read');

    const settingsUpdate = await fetch(`http://127.0.0.1:${listening.port}/admin-api/contact-form/settings`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        formTitle: 'Talk to Our Team',
        submitButtonText: 'Send',
        successMessage: 'Received and queued.'
      })
    });

    assert.equal(settingsUpdate.status, 200);

    const publicForm = await fetch(`http://127.0.0.1:${listening.port}/contact?success=1`);
    const publicHtml = await publicForm.text();
    assert.equal(publicHtml.includes('Talk to Our Team'), true);
    assert.equal(publicHtml.includes('Received and queued.'), true);

    const adminPageDefinition = started.runtime.adminPages.get('/admin/contact-form');
    assert.equal(Boolean(adminPageDefinition), true);
    assert.equal(adminPageDefinition?.title, 'Contact Form');
  } finally {
    await started.server.stop();
  }
});

test('phase 171: contact form anti-spam blocks rapid repeat submission and honeypot stays silent', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd);
  writeInstallState(cwd);
  installContactPlugin(cwd);

  const started = await createTestServer({ cwd });
  const listening = await started.server.start();

  try {
    const first = await submitContact(listening.port, {
      name: 'First Sender',
      email: 'first@example.com',
      subject: 'One',
      message: 'First message',
      website: ''
    });
    assert.equal(first.status, 302);

    const second = await submitContact(listening.port, {
      name: 'Second Sender',
      email: 'second@example.com',
      subject: 'Two',
      message: 'Second message',
      website: ''
    });
    assert.equal(second.status, 400);
    assert.equal((await second.text()).includes('Please wait a few seconds before sending another message.'), true);

    const honeypot = await submitContact(listening.port, {
      name: 'Bot',
      email: 'bot@example.com',
      subject: 'Spam',
      message: 'You should not store this.',
      website: 'https://spam.invalid'
    });
    assert.equal(honeypot.status, 302);

    const entries = started.runtime.db.query('contact-submission', { sort: 'id asc' });
    assert.equal(entries.length, 1);
    assert.equal(entries[0]?.data?.email, 'first@example.com');
  } finally {
    await started.server.stop();
  }
});

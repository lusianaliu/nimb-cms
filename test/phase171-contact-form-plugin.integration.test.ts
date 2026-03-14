import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createTestServer } from './helpers/create-test-server.ts';
import net from 'node:net';

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

test('phase 172: notification path sends smtp email when enabled and valid settings are configured', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd);
  writeInstallState(cwd);
  installContactPlugin(cwd);

  const started = await createTestServer({ cwd });
  const listening = await started.server.start();

  const smtpEvents: string[] = [];
  const smtpServer = net.createServer((socket) => {
    socket.setEncoding('utf8');
    socket.write('220 nimb-test-smtp\r\n');

    let dataMode = false;
    let buffer = '';

    socket.on('data', (chunk) => {
      buffer += chunk;
      while (buffer.includes('\r\n')) {
        const lineBreak = buffer.indexOf('\r\n');
        const line = buffer.slice(0, lineBreak);
        buffer = buffer.slice(lineBreak + 2);

        if (dataMode) {
          if (line === '.') {
            dataMode = false;
            socket.write('250 Message accepted\r\n');
          } else {
            smtpEvents.push(`DATA:${line}`);
          }
          continue;
        }

        const normalized = line.toUpperCase();
        smtpEvents.push(normalized);
        if (normalized.startsWith('EHLO') || normalized.startsWith('HELO')) {
          socket.write('250-nimb-test-smtp\r\n250 AUTH PLAIN LOGIN\r\n');
        } else if (normalized.startsWith('MAIL FROM')) {
          socket.write('250 OK\r\n');
        } else if (normalized.startsWith('RCPT TO')) {
          socket.write('250 OK\r\n');
        } else if (normalized === 'DATA') {
          dataMode = true;
          socket.write('354 End data with <CR><LF>.<CR><LF>\r\n');
        } else if (normalized === 'QUIT') {
          socket.write('221 Bye\r\n');
          socket.end();
        } else {
          socket.write('250 OK\r\n');
        }
      }
    });
  });

  await new Promise<void>((resolve) => smtpServer.listen(0, '127.0.0.1', () => resolve()));
  const smtpAddress = smtpServer.address();
  assert.equal(typeof smtpAddress, 'object');
  const smtpPort = smtpAddress && 'port' in smtpAddress ? smtpAddress.port : 0;

  try {
    const settingsUpdate = await fetch(`http://127.0.0.1:${listening.port}/admin-api/contact-form/settings`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        formTitle: 'Contact Us',
        submitButtonText: 'Send Message',
        successMessage: 'Stored',
        notification: {
          enabled: true,
          recipientEmail: 'owner@example.com',
          fromName: 'Nimb Notifications',
          fromEmail: 'notify@example.com',
          smtpHost: '127.0.0.1',
          smtpPort,
          smtpSecure: false,
          smtpUsername: '',
          smtpPassword: ''
        }
      })
    });
    assert.equal(settingsUpdate.status, 200);

    const submit = await submitContact(listening.port, {
      name: 'SMTP Sender',
      email: 'sender@example.com',
      subject: 'SMTP Test',
      message: 'This should trigger a notification email.',
      website: ''
    });
    assert.equal(submit.status, 302);

    const entries = started.runtime.db.query('contact-submission', { sort: 'id desc' });
    assert.equal(entries.length, 1);
    assert.equal(entries[0]?.data?.email, 'sender@example.com');

    assert.equal(smtpEvents.some((line) => line.startsWith('MAIL FROM')), true);
    assert.equal(smtpEvents.some((line) => line.startsWith('RCPT TO')), true);
    assert.equal(smtpEvents.some((line) => line.toUpperCase().includes('SUBJECT: NEW CONTACT FORM SUBMISSION: SMTP TEST')), true);
  } finally {
    await started.server.stop();
    await new Promise<void>((resolve) => smtpServer.close(() => resolve()));
  }
});

test('phase 172: notification is skipped when disabled and submission remains successful', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd);
  writeInstallState(cwd);
  installContactPlugin(cwd);

  const started = await createTestServer({ cwd });
  const listening = await started.server.start();

  try {
    const settingsResponse = await fetch(`http://127.0.0.1:${listening.port}/admin-api/contact-form/settings`);
    const settingsBody = await settingsResponse.json();
    assert.equal(settingsBody.notification.enabled, false);

    const submit = await submitContact(listening.port, {
      name: 'No Email Sender',
      email: 'no-email@example.com',
      subject: 'Stored only',
      message: 'Keep storage as source of truth.',
      website: ''
    });

    assert.equal(submit.status, 302);
    const entries = started.runtime.db.query('contact-submission', {});
    assert.equal(entries.length, 1);
  } finally {
    await started.server.stop();
  }
});

test('phase 172: smtp failure does not block submission success and settings persist', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd);
  writeInstallState(cwd);
  installContactPlugin(cwd);

  const started = await createTestServer({ cwd });
  const listening = await started.server.start();

  try {
    const settingsUpdate = await fetch(`http://127.0.0.1:${listening.port}/admin-api/contact-form/settings`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        formTitle: 'Contact Us',
        submitButtonText: 'Send Message',
        successMessage: 'Stored',
        notification: {
          enabled: true,
          recipientEmail: 'owner@example.com',
          fromName: 'Nimb Notifications',
          fromEmail: 'notify@example.com',
          smtpHost: '127.0.0.1',
          smtpPort: 1,
          smtpSecure: false,
          smtpUsername: 'smtp-user',
          smtpPassword: 'smtp-pass'
        }
      })
    });
    assert.equal(settingsUpdate.status, 200);

    const persistedSettings = await fetch(`http://127.0.0.1:${listening.port}/admin-api/contact-form/settings`);
    const persistedSettingsBody = await persistedSettings.json();
    assert.equal(persistedSettingsBody.notification.enabled, true);
    assert.equal(persistedSettingsBody.notification.smtpUsername, 'smtp-user');
    assert.equal(persistedSettingsBody.notification.smtpPassword, 'smtp-pass');

    const submit = await submitContact(listening.port, {
      name: 'Failure Sender',
      email: 'failure@example.com',
      subject: 'SMTP unavailable',
      message: 'Storage should still succeed.',
      website: ''
    });

    assert.equal(submit.status, 302);
    assert.equal(submit.headers.get('location'), '/contact?success=1');

    const entries = started.runtime.db.query('contact-submission', { sort: 'id asc' });
    assert.equal(entries.length, 1);
    assert.equal(entries[0]?.data?.email, 'failure@example.com');
  } finally {
    await started.server.stop();
  }
});


test('phase 173: settings API exposes notification health hint states for disabled and incomplete config', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd);
  writeInstallState(cwd);
  installContactPlugin(cwd);

  const started = await createTestServer({ cwd });
  const listening = await started.server.start();

  try {
    const initialSettingsResponse = await fetch(`http://127.0.0.1:${listening.port}/admin-api/contact-form/settings`);
    const initialSettings = await initialSettingsResponse.json();
    assert.equal(initialSettings.notificationHealthHint.message.includes('Email notifications are off'), true);

    const incompleteUpdate = await fetch(`http://127.0.0.1:${listening.port}/admin-api/contact-form/settings`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        formTitle: 'Contact Us',
        submitButtonText: 'Send Message',
        successMessage: 'Stored',
        notification: {
          enabled: true,
          recipientEmail: '',
          fromName: 'Nimb Notifications',
          fromEmail: '',
          smtpHost: '',
          smtpPort: 587,
          smtpSecure: false,
          smtpUsername: '',
          smtpPassword: ''
        }
      })
    });
    assert.equal(incompleteUpdate.status, 200);

    const incompleteSettingsResponse = await fetch(`http://127.0.0.1:${listening.port}/admin-api/contact-form/settings`);
    const incompleteSettings = await incompleteSettingsResponse.json();
    assert.equal(incompleteSettings.notificationHealthHint.message.includes('Notification settings are incomplete'), true);
  } finally {
    await started.server.stop();
  }
});

test('phase 173: notification health metadata tracks success and failed attempts without changing storage-first behavior', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd);
  writeInstallState(cwd);
  installContactPlugin(cwd);

  const started = await createTestServer({ cwd });
  const listening = await started.server.start();

  const smtpServer = net.createServer((socket) => {
    socket.setEncoding('utf8');
    socket.write('220 nimb-test-smtp\r\n');

    let dataMode = false;
    let buffer = '';

    socket.on('data', (chunk) => {
      buffer += chunk;
      while (buffer.includes('\r\n')) {
        const lineBreak = buffer.indexOf('\r\n');
        const line = buffer.slice(0, lineBreak);
        buffer = buffer.slice(lineBreak + 2);

        if (dataMode) {
          if (line === '.') {
            dataMode = false;
            socket.write('250 Message accepted\r\n');
          }
          continue;
        }

        const normalized = line.toUpperCase();
        if (normalized.startsWith('EHLO') || normalized.startsWith('HELO')) {
          socket.write('250-nimb-test-smtp\r\n250 AUTH PLAIN LOGIN\r\n');
        } else if (normalized.startsWith('MAIL FROM')) {
          socket.write('250 OK\r\n');
        } else if (normalized.startsWith('RCPT TO')) {
          socket.write('250 OK\r\n');
        } else if (normalized === 'DATA') {
          dataMode = true;
          socket.write('354 End data with <CR><LF>.<CR><LF>\r\n');
        } else if (normalized === 'QUIT') {
          socket.write('221 Bye\r\n');
          socket.end();
        } else {
          socket.write('250 OK\r\n');
        }
      }
    });
  });

  await new Promise<void>((resolve) => smtpServer.listen(0, '127.0.0.1', () => resolve()));
  const smtpAddress = smtpServer.address();
  assert.equal(typeof smtpAddress, 'object');
  const smtpPort = smtpAddress && 'port' in smtpAddress ? smtpAddress.port : 0;

  try {
    const settingsUpdate = await fetch(`http://127.0.0.1:${listening.port}/admin-api/contact-form/settings`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        formTitle: 'Contact Us',
        submitButtonText: 'Send Message',
        successMessage: 'Stored',
        notification: {
          enabled: true,
          recipientEmail: 'owner@example.com',
          fromName: 'Nimb Notifications',
          fromEmail: 'notify@example.com',
          smtpHost: '127.0.0.1',
          smtpPort,
          smtpSecure: false,
          smtpUsername: '',
          smtpPassword: ''
        }
      })
    });
    assert.equal(settingsUpdate.status, 200);

    const successSubmit = await submitContact(listening.port, {
      name: 'Health Success',
      email: 'health-success@example.com',
      subject: 'Healthy SMTP',
      message: 'Health should mark success.',
      website: ''
    });
    assert.equal(successSubmit.status, 302);

    const successHealth = await fetch(`http://127.0.0.1:${listening.port}/admin-api/contact-form/settings`);
    const successHealthBody = await successHealth.json();
    assert.equal(successHealthBody.notificationHealth.lastNotificationStatus, 'success');
    assert.equal(Boolean(successHealthBody.notificationHealth.lastNotificationAttemptAt), true);
    assert.equal(successHealthBody.notificationHealthHint.message.includes('sent successfully'), true);

    await new Promise<void>((resolve) => smtpServer.close(() => resolve()));

    const failedForm = new URLSearchParams({
      name: 'Health Failure',
      email: 'health-failure@example.com',
      subject: 'SMTP down',
      message: 'Health should mark failure.',
      website: ''
    });
    const failedSubmit = await fetch(`http://127.0.0.1:${listening.port}/contact`, {
      method: 'POST',
      redirect: 'manual',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'x-forwarded-for': '203.0.113.17'
      },
      body: failedForm.toString()
    });
    assert.equal(failedSubmit.status, 302);

    const failedHealth = await fetch(`http://127.0.0.1:${listening.port}/admin-api/contact-form/settings`);
    const failedHealthBody = await failedHealth.json();
    assert.equal(failedHealthBody.notificationHealth.lastNotificationStatus, 'failed');
    assert.equal(failedHealthBody.notificationHealthHint.message.includes('New messages are still being saved'), true);

    const entries = started.runtime.db.query('contact-submission', { sort: 'id asc' });
    assert.equal(entries.length, 2);
  } finally {
    await started.server.stop();
  }
});


test('phase 174: per-submission notification status is stored as skipped and exposed in admin submission APIs', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd);
  writeInstallState(cwd);
  installContactPlugin(cwd);

  const started = await createTestServer({ cwd });
  const listening = await started.server.start();

  try {
    const submit = await submitContact(listening.port, {
      name: 'Skipped Sender',
      email: 'skipped@example.com',
      subject: 'Stored only',
      message: 'Notification is disabled.',
      website: ''
    });

    assert.equal(submit.status, 302);

    const stored = started.runtime.db.query('contact-submission', { sort: 'id desc' });
    assert.equal(stored.length, 1);
    assert.equal(stored[0]?.data?.notificationStatus, 'skipped');
    assert.equal(Boolean(stored[0]?.data?.notificationAttemptedAt), true);
    assert.equal(stored[0]?.data?.notificationSkipReason, 'email notifications are off');

    const listResponse = await fetch(`http://127.0.0.1:${listening.port}/admin-api/contact-form/submissions`);
    assert.equal(listResponse.status, 200);
    const listBody = await listResponse.json();
    assert.equal(listBody[0].notificationStatus, 'skipped');
    assert.equal(listBody[0].notificationBadgeLabel, 'Skipped');

    const detailResponse = await fetch(`http://127.0.0.1:${listening.port}/admin-api/contact-form/submissions/${stored[0].id}`);
    assert.equal(detailResponse.status, 200);
    const detailBody = await detailResponse.json();
    assert.equal(detailBody.notificationDetailText.includes('The message is still saved'), true);
  } finally {
    await started.server.stop();
  }
});

test('phase 174: per-submission notification status captures success and failure without breaking storage-first success', async () => {
  const cwd = mkdtemp();
  writeConfig(cwd);
  writeInstallState(cwd);
  installContactPlugin(cwd);

  const started = await createTestServer({ cwd });
  const listening = await started.server.start();

  const smtpServer = net.createServer((socket) => {
    socket.setEncoding('utf8');
    socket.write('220 nimb-test-smtp\r\n');

    let dataMode = false;
    let buffer = '';

    socket.on('data', (chunk) => {
      buffer += chunk;
      while (buffer.includes('\r\n')) {
        const lineBreak = buffer.indexOf('\r\n');
        const line = buffer.slice(0, lineBreak);
        buffer = buffer.slice(lineBreak + 2);

        if (dataMode) {
          if (line === '.') {
            dataMode = false;
            socket.write('250 Message accepted\r\n');
          }
          continue;
        }

        const normalized = line.toUpperCase();
        if (normalized.startsWith('EHLO') || normalized.startsWith('HELO')) {
          socket.write('250-nimb-test-smtp\r\n250 AUTH PLAIN LOGIN\r\n');
        } else if (normalized.startsWith('MAIL FROM')) {
          socket.write('250 OK\r\n');
        } else if (normalized.startsWith('RCPT TO')) {
          socket.write('250 OK\r\n');
        } else if (normalized === 'DATA') {
          dataMode = true;
          socket.write('354 End data with <CR><LF>.<CR><LF>\r\n');
        } else if (normalized === 'QUIT') {
          socket.write('221 Bye\r\n');
          socket.end();
        } else {
          socket.write('250 OK\r\n');
        }
      }
    });
  });

  await new Promise<void>((resolve) => smtpServer.listen(0, '127.0.0.1', () => resolve()));
  const smtpAddress = smtpServer.address();
  assert.equal(typeof smtpAddress, 'object');
  const smtpPort = smtpAddress && 'port' in smtpAddress ? smtpAddress.port : 0;

  try {
    const settingsUpdate = await fetch(`http://127.0.0.1:${listening.port}/admin-api/contact-form/settings`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        formTitle: 'Contact Us',
        submitButtonText: 'Send Message',
        successMessage: 'Stored',
        notification: {
          enabled: true,
          recipientEmail: 'owner@example.com',
          fromName: 'Nimb Notifications',
          fromEmail: 'notify@example.com',
          smtpHost: '127.0.0.1',
          smtpPort,
          smtpSecure: false,
          smtpUsername: '',
          smtpPassword: ''
        }
      })
    });
    assert.equal(settingsUpdate.status, 200);

    const successSubmit = await submitContact(listening.port, {
      name: 'Success Sender',
      email: 'success@example.com',
      subject: 'SMTP up',
      message: 'Expect success status.',
      website: ''
    });
    assert.equal(successSubmit.status, 302);

    await new Promise<void>((resolve) => smtpServer.close(() => resolve()));

    const failedSubmitForm = new URLSearchParams({
      name: 'Failure Sender',
      email: 'failed@example.com',
      subject: 'SMTP down',
      message: 'Expect failure status but saved message.',
      website: ''
    });
    const failedSubmit = await fetch(`http://127.0.0.1:${listening.port}/contact`, {
      method: 'POST',
      redirect: 'manual',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'x-forwarded-for': '198.51.100.24'
      },
      body: failedSubmitForm.toString()
    });
    assert.equal(failedSubmit.status, 302);

    const rows = started.runtime.db.query('contact-submission', { sort: 'id asc' });
    assert.equal(rows.length, 2);
    assert.equal(rows[0]?.data?.notificationStatus, 'success');
    assert.equal(rows[1]?.data?.notificationStatus, 'failed');
    assert.equal(Boolean(rows[1]?.data?.notificationErrorSummary), true);

    const listResponse = await fetch(`http://127.0.0.1:${listening.port}/admin-api/contact-form/submissions`);
    assert.equal(listResponse.status, 200);
    const listBody = await listResponse.json();
    assert.equal(listBody[0].notificationBadgeLabel, 'Failed');
    assert.equal(listBody[1].notificationBadgeLabel, 'Sent');
  } finally {
    await started.server.stop();
    if (smtpServer.listening) {
      await new Promise<void>((resolve) => smtpServer.close(() => resolve()));
    }
  }
});

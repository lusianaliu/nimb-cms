import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import http from 'node:http';

const INSTALL_STATE_PATH = '/data/system/install.json';
const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nimb-phase78-'));

const writeConfig = (cwd) => {
  fs.writeFileSync(path.join(cwd, 'nimb.config.json'), `${JSON.stringify({
    name: 'nimb-app',
    plugins: [],
    runtime: { logLevel: 'info', mode: 'development' },
    admin: { enabled: false },
    server: { port: 43178 }
  }, null, 2)}\n`);
};

const withInstallState = async (run) => {
  const previousContent = fs.existsSync(INSTALL_STATE_PATH)
    ? fs.readFileSync(INSTALL_STATE_PATH, 'utf8')
    : null;

  try {
    await run();
  } finally {
    if (previousContent === null) {
      fs.rmSync(INSTALL_STATE_PATH, { force: true });
    } else {
      fs.mkdirSync(path.dirname(INSTALL_STATE_PATH), { recursive: true });
      fs.writeFileSync(INSTALL_STATE_PATH, previousContent, 'utf8');
    }
  }
};

const waitForReady = (child) => new Promise((resolve, reject) => {
  let stdout = '';
  let stderr = '';
  const timeout = setTimeout(() => {
    reject(new Error(`Timed out waiting for startup. stdout=${stdout} stderr=${stderr}`));
  }, 15000);

  child.stdout.on('data', (chunk) => {
    stdout += String(chunk);
    if (stdout.includes('Ready.')) {
      clearTimeout(timeout);
      resolve({ stdout, stderr });
    }
  });

  child.stderr.on('data', (chunk) => {
    stderr += String(chunk);
  });

  child.once('exit', (code) => {
    clearTimeout(timeout);
    reject(new Error(`Process exited before ready. code=${code} stdout=${stdout} stderr=${stderr}`));
  });
});

const stopProcess = (child) => new Promise((resolve) => {
  if (child.killed) {
    resolve(undefined);
    return;
  }

  child.once('exit', () => resolve(undefined));
  child.kill('SIGTERM');
});


const requestRoot = (port) => new Promise((resolve, reject) => {
  const request = http.request({
    hostname: '127.0.0.1',
    port,
    path: '/',
    method: 'GET',
    headers: { connection: 'close' },
    agent: false
  }, (response) => {
    let body = '';
    response.setEncoding('utf8');
    response.on('data', (chunk) => {
      body += chunk;
    });
    response.on('end', () => {
      resolve({ statusCode: response.statusCode ?? 0, body });
    });
  });

  request.on('error', reject);
  request.end();
});

const pollRuntimeRoot = async (port) => {
  const startedAt = Date.now();

  while (Date.now() - startedAt < 8000) {
    try {
      const response = await requestRoot(port);
      const rawBody = response.body;
      const body = (() => {
        try {
          return JSON.parse(rawBody);
        } catch (_error) {
          return null;
        }
      })();

      if (!(response.statusCode === 200 && body?.status === 'install')) {
        return { response, body, rawBody };
      }
    } catch (_error) {
      // restart window may briefly refuse connections while the old server closes
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error('Timed out waiting for runtime mode response at /');
};

test('phase 78: POST /install automatically transitions server to runtime mode', async () => {
  await withInstallState(async () => {
    fs.rmSync(INSTALL_STATE_PATH, { force: true });

    const cwd = mkdtemp();
    writeConfig(cwd);

    const child = spawn(process.execPath, ['bin/nimb.js'], {
      cwd: path.resolve(process.cwd()),
      env: {
        ...process.env,
        NIMB_PROJECT_ROOT: cwd,
        PORT: '43178'
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    try {
      await waitForReady(child);

      const initial = await fetch('http://127.0.0.1:43178/');
      assert.equal(initial.status, 200);
      assert.deepEqual(await initial.json(), {
        status: 'install',
        message: 'Nimb is not installed'
      });

      const install = await fetch('http://127.0.0.1:43178/install', { method: 'POST' });
      assert.equal(install.status, 200);
      assert.deepEqual(await install.json(), {
        status: 'installed',
        rebootRequired: true
      });

      const { response, body } = await pollRuntimeRoot(43178);
      assert.notEqual(response.statusCode, 200);
      assert.notEqual(body?.status, 'install');
    } finally {
      await stopProcess(child);
    }
  });
});

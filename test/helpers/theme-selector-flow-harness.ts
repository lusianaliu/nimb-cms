import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createInstalledServer } from './create-installed-server.ts';

type ThemeDescriptor = {
  id?: string
  label?: string
};

type ThemeStatusPayload = {
  configuredThemeId?: string
  resolvedThemeId?: string
  themes?: ThemeDescriptor[]
};

export async function createThemeSelectorFlowHarness(phaseTag: string) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), `nimb-${phaseTag}-`));
  fs.writeFileSync(path.join(cwd, 'nimb.config.json'), `${JSON.stringify({
    name: 'nimb-app',
    plugins: [],
    runtime: { logLevel: 'info', mode: 'development' },
    admin: { enabled: true }
  }, null, 2)}\n`);

  const { server, port } = await createInstalledServer({ cwd });

  const loginResponse = await fetch(`http://127.0.0.1:${port}/admin/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ email: 'admin@nimb.local', password: 'admin' }).toString(),
    redirect: 'manual'
  });

  if (loginResponse.status !== 302) {
    await server.stop();
    throw new Error(`Login failed for theme selector flow harness: ${loginResponse.status}`);
  }

  const authCookie = (loginResponse.headers.get('set-cookie') ?? '').split(';')[0];

  const request = (requestPath: string, init?: RequestInit) => fetch(`http://127.0.0.1:${port}${requestPath}`, {
    ...init,
    headers: {
      cookie: authCookie,
      ...(init?.headers ?? {})
    }
  });

  const getThemeStatus = async (): Promise<ThemeStatusPayload> => {
    const response = await request('/admin-api/system/themes');
    if (!response.ok) {
      throw new Error(`Could not read theme status: ${response.status}`);
    }
    return response.json() as Promise<ThemeStatusPayload>;
  };

  const setTheme = async (themeId: string) => {
    const response = await request('/admin-api/system/themes', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ themeId })
    });
    return response;
  };

  const getAlternateThemeId = (status: ThemeStatusPayload) => {
    const configured = status.configuredThemeId ?? '';
    const ids = (Array.isArray(status.themes) ? status.themes : [])
      .map((theme) => theme?.id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);

    return ids.find((id) => id !== configured) ?? null;
  };

  return {
    cwd,
    port,
    authCookie,
    request,
    getThemeStatus,
    setTheme,
    getAlternateThemeId,
    stop: () => server.stop()
  };
}

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const resolveProjectRoot = (projectModel) => projectModel?.projectRoot ?? projectModel?.root;
const resolveConfigDir = (projectModel) => projectModel?.configDir ?? path.join(resolveProjectRoot(projectModel), 'config');
const resolvePublicDir = (projectModel) => projectModel?.publicDir ?? projectModel?.publicDirectory ?? path.join(resolveProjectRoot(projectModel), 'public');
const resolveConfigFile = (projectModel) => projectModel?.configFile ?? path.join(resolveConfigDir(projectModel), 'nimb.config.json');
const resolvePersistenceDir = (projectModel) => projectModel?.persistenceDir ?? path.join(resolveProjectRoot(projectModel), 'data', 'system');

const writeFileIfMissing = (filePath, content) => {
  if (fs.existsSync(filePath)) {
    return;
  }

  fs.writeFileSync(filePath, content);
};

export const bootstrapDefaultSite = async (projectModel) => {
  const projectRoot = resolveProjectRoot(projectModel);

  if (typeof projectRoot !== 'string' || projectRoot.trim() === '') {
    throw new Error('Project root is unavailable for default site bootstrap');
  }

  const configDir = resolveConfigDir(projectModel);
  const publicDir = resolvePublicDir(projectModel);
  const siteConfigPath = path.join(configDir, 'site.json');
  const indexPath = path.join(publicDir, 'index.html');
  const runtimeConfigPath = resolveConfigFile(projectModel);
  const persistenceDir = resolvePersistenceDir(projectModel);
  const adminStatePath = path.join(persistenceDir, 'admin.json');

  fs.mkdirSync(configDir, { recursive: true });
  fs.mkdirSync(publicDir, { recursive: true });
  fs.mkdirSync(persistenceDir, { recursive: true });

  writeFileIfMissing(siteConfigPath, `${JSON.stringify({
    name: 'My Nimb Site',
    createdAt: new Date().toISOString()
  }, null, 2)}\n`);

  writeFileIfMissing(indexPath, '<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="utf-8">\n    <meta name="viewport" content="width=device-width, initial-scale=1">\n    <title>My Nimb Site</title>\n  </head>\n  <body>\n    <h1>Welcome to Nimb</h1>\n    <p>Your site is ready.</p>\n  </body>\n</html>\n');

  writeFileIfMissing(runtimeConfigPath, `${JSON.stringify({
    server: { port: 3000 },
    admin: {
      enabled: true,
      basePath: '/admin'
    }
  }, null, 2)}\n`);

  writeFileIfMissing(adminStatePath, `${JSON.stringify({
    username: 'admin',
    passwordHash: crypto.createHash('sha256').update('admin').digest('hex')
  }, null, 2)}\n`);
};

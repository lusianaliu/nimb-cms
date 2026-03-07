import { hasInstallLock } from '../installer/install-lock.ts';
import { redirectResponse } from './response.ts';

const staticAssetPrefixes = Object.freeze(['/assets/', '/static/', '/public/', '/uploads/']);

const isStaticAssetPath = (requestPath: string) => {
  if (requestPath === '/favicon.ico' || requestPath === '/robots.txt') {
    return true;
  }

  return staticAssetPrefixes.some((prefix) => requestPath.startsWith(prefix));
};

const isAllowedPath = (path: string, method: string) => {
  if (path === '/health') {
    return true;
  }

  if (path === '/install') {
    return method === 'GET' || method === 'POST';
  }

  return isStaticAssetPath(path);
};

export const installGuardMiddleware = (runtime) => (context, next) => {
  const projectRoot = runtime?.projectPaths?.projectRoot ?? runtime?.project?.projectRoot;
  const installed = hasInstallLock({ projectRoot });

  if (installed) {
    return next();
  }

  if (isAllowedPath(context.path, context.method)) {
    return next();
  }

  return redirectResponse('/install');
};

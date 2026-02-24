import { redirectResponse } from './response.ts';

const staticAssetPrefixes = Object.freeze(['/assets/', '/static/', '/public/']);

const isStaticAssetPath = (requestPath) => {
  if (requestPath === '/favicon.ico' || requestPath === '/robots.txt') {
    return true;
  }

  return staticAssetPrefixes.some((prefix) => requestPath.startsWith(prefix));
};

export const installerGate = (runtime) => (context, next) => {
  if (runtime?.getRuntimeMode?.() !== 'installer') {
    return next();
  }

  if (context.path.startsWith('/install') || isStaticAssetPath(context.path)) {
    return next();
  }

  return redirectResponse('/install');
};

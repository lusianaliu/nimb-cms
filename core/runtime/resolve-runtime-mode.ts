import { isSystemInstalled } from '../system/system-config.ts';
import type { RuntimeMode } from './runtime-mode.ts';

export const resolveRuntimeMode = (projectModel): RuntimeMode => {
  const projectRoot = projectModel?.projectRoot ?? projectModel?.root ?? process.cwd();
  return isSystemInstalled({ projectRoot }) ? 'normal' : 'installer';
};

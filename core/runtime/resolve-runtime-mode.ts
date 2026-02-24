import { isProjectInstalled } from '../project/index.ts';
import type { RuntimeMode } from './runtime-mode.ts';

export const resolveRuntimeMode = (projectModel): RuntimeMode => (isProjectInstalled(projectModel) ? 'normal' : 'installer');

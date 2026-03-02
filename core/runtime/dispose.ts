export const disposeRuntime = (runtime) => {
  if (!runtime || runtime.__disposed === true) {
    return;
  }

  if (Array.isArray(runtime.plugins)) {
    runtime.plugins.forEach((plugin) => {
      if (typeof plugin?.dispose === 'function') {
        plugin.dispose();
      }
    });
  } else if (typeof runtime.plugins?.forEach === 'function') {
    runtime.plugins.forEach((plugin) => {
      if (typeof plugin?.dispose === 'function') {
        plugin.dispose();
      }
    });
  } else if (typeof runtime.plugins?.list === 'function') {
    for (const plugin of runtime.plugins.list()) {
      if (typeof plugin?.dispose === 'function') {
        plugin.dispose();
      }
    }
  }

  runtime.events?.removeAllListeners?.();

  runtime.capabilities?.clear?.();
  runtime.admin?.registry?.clear?.();
  runtime.adminRegistry?.clear?.();

  runtime.__disposed = true;
};

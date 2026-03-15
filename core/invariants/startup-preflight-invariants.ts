import { formatWritableDirectoryRemediation } from './remediation-fragments.ts';

export type SharedInvariantDefinition = {
  id: string;
  title: string;
  severityIntent: {
    startup?: 'FAIL';
    preflight: {
      fail: 'FAIL';
      warn?: 'WARN';
    };
  };
  why: string;
  remediation: string;
};

export const SHARED_STARTUP_PREFLIGHT_INVARIANTS = Object.freeze({
  adminStaticDir: Object.freeze({
    id: 'admin-static-dir',
    title: 'Admin static directory',
    severityIntent: Object.freeze({
      startup: 'FAIL',
      preflight: Object.freeze({
        fail: 'FAIL',
        warn: 'WARN'
      })
    }),
    why: 'Startup validates configured admin staticDir paths so admin UI delivery does not silently drift from deployment expectations.',
    remediation: 'If config.admin.staticDir is set, make sure it resolves to an existing directory. Remove config.admin.staticDir to use the built-in fallback path.'
  } satisfies SharedInvariantDefinition),
  persistenceRuntimeJson: Object.freeze({
    id: 'persistence-runtime-json',
    title: 'Persistence runtime file',
    severityIntent: Object.freeze({
      startup: 'FAIL',
      preflight: Object.freeze({
        fail: 'FAIL'
      })
    }),
    why: 'Startup reads data/system/runtime.json when present and fails if the file is not valid JSON.',
    remediation: 'Fix JSON formatting in data/system/runtime.json, replace it with a valid file, or remove it so startup can recreate state safely.'
  } satisfies SharedInvariantDefinition),
  startupPort: Object.freeze({
    id: 'startup-port',
    title: 'Startup port availability',
    severityIntent: Object.freeze({
      startup: 'FAIL',
      preflight: Object.freeze({
        fail: 'FAIL'
      })
    }),
    why: 'Canonical startup validates that the selected startup port is valid and bindable before HTTP boot.',
    remediation: 'Set PORT (or config.server.port) to a valid, free port before startup.'
  } satisfies SharedInvariantDefinition),
  installStateConfigJson: Object.freeze({
    id: 'install-state-config-json',
    title: 'Install-state source path',
    severityIntent: Object.freeze({
      preflight: Object.freeze({
        fail: 'FAIL',
        warn: 'WARN'
      })
    }),
    why: 'Canonical install state is read from data/system/config.json.',
    remediation: 'Ensure data/system/config.json exists as valid JSON so installed/uninstalled behavior matches deployment intent.'
  } satisfies SharedInvariantDefinition),
  dataDirectoryWritable: Object.freeze({
    id: 'data-directory-writable',
    title: 'Data directory writability',
    severityIntent: Object.freeze({
      startup: 'FAIL',
      preflight: Object.freeze({
        fail: 'FAIL',
        warn: 'WARN'
      })
    }),
    why: 'Startup requires writable data directories for system/content/uploads state.',
    remediation: formatWritableDirectoryRemediation('data/, data/system, data/content, and data/uploads')
  } satisfies SharedInvariantDefinition),
  persistenceDirectoryWritable: Object.freeze({
    id: 'persistence-directory-writable',
    title: 'Persistence directory writability',
    severityIntent: Object.freeze({
      startup: 'FAIL',
      preflight: Object.freeze({
        fail: 'FAIL',
        warn: 'WARN'
      })
    }),
    why: 'Startup requires a writable persistence directory for runtime persistence files.',
    remediation: formatWritableDirectoryRemediation('the persistence directory (canonical path: data/system)')
  } satisfies SharedInvariantDefinition),
  logsDirectoryWritable: Object.freeze({
    id: 'logs-directory-writable',
    title: 'Logs directory writability',
    severityIntent: Object.freeze({
      startup: 'FAIL',
      preflight: Object.freeze({
        fail: 'FAIL',
        warn: 'WARN'
      })
    }),
    why: 'Startup requires a writable logs directory for runtime diagnostics output.',
    remediation: formatWritableDirectoryRemediation('logs/')
  } satisfies SharedInvariantDefinition)
});

export type SharedInvariantKey = keyof typeof SHARED_STARTUP_PREFLIGHT_INVARIANTS;

export const getSharedInvariant = (key: SharedInvariantKey): SharedInvariantDefinition => SHARED_STARTUP_PREFLIGHT_INVARIANTS[key];

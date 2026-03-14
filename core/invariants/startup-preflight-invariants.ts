export type SharedInvariantDefinition = {
  id: string;
  title: string;
  severityIntent: {
    startup: 'FAIL';
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
  } satisfies SharedInvariantDefinition)
});

export type SharedInvariantKey = keyof typeof SHARED_STARTUP_PREFLIGHT_INVARIANTS;

export const getSharedInvariant = (key: SharedInvariantKey): SharedInvariantDefinition => SHARED_STARTUP_PREFLIGHT_INVARIANTS[key];

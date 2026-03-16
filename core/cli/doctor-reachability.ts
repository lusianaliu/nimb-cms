import { loadConfig } from '../bootstrap/index.ts';
import { assertValidStartupPort } from '../invariants/startup-port.ts';
import { loadSystemConfig } from '../system/system-config.ts';

export type ReachabilityDoctorReport = {
  projectRoot: string;
  startup: {
    expectedBindHost: string;
    bindHostReason: string;
    expectedPort: number;
    portSource: string;
    expectedAdminBasePath: string;
  };
  localUrlsToTryFirst: string[];
  localOnlyBoundary: {
    provenByThisCommand: string[];
    notProvenByThisCommand: string[];
    likelyBeyondLocalNimbWhen: string[];
  };
  supportHandoff: {
    summary: string;
    payload: {
      projectRoot: string;
      expectedBindHost: string;
      expectedPort: number;
      expectedAdminBasePath: string;
      localUrlsToTryFirst: string[];
      installed: boolean;
      installedAt: string | null;
      portSource: string;
    };
    exportCommand: string;
  };
};

const resolveEffectivePort = (config, env: NodeJS.ProcessEnv) => {
  const envPort = env.PORT;
  if (envPort !== undefined && `${envPort}`.trim() !== '') {
    return {
      port: assertValidStartupPort(Number(envPort), 'PORT environment variable'),
      source: 'PORT environment variable'
    };
  }

  if (config?.server?.port !== undefined) {
    return {
      port: assertValidStartupPort(config.server.port, 'config.server.port'),
      source: 'config.server.port'
    };
  }

  return {
    port: 3000,
    source: 'default fallback (3000)'
  };
};

export const runReachabilityDoctor = ({ projectRoot, env = process.env }: { projectRoot: string; env?: NodeJS.ProcessEnv }): ReachabilityDoctorReport => {
  const config = loadConfig({ cwd: projectRoot });
  const systemConfig = loadSystemConfig({ projectRoot });
  const effectivePort = resolveEffectivePort(config, env);
  const adminBasePath = config.admin?.basePath ?? '/admin';

  const localUrls = [
    `http://127.0.0.1:${effectivePort.port}/`,
    `http://127.0.0.1:${effectivePort.port}${adminBasePath}`,
    `http://localhost:${effectivePort.port}/`,
    `http://localhost:${effectivePort.port}${adminBasePath}`
  ];

  return {
    projectRoot,
    startup: {
      expectedBindHost: 'all local interfaces (Node listen default host)',
      bindHostReason: 'Nimb startup uses Node server.listen(port) without an explicit host override in active runtime startup.',
      expectedPort: effectivePort.port,
      portSource: effectivePort.source,
      expectedAdminBasePath: adminBasePath
    },
    localUrlsToTryFirst: localUrls,
    localOnlyBoundary: {
      provenByThisCommand: [
        'Shows the expected startup bind host behavior and effective port from current config/env assumptions.',
        'Shows local URLs to try first on the same machine/process namespace before external routing checks.',
        'Shows install-state context from data/system/config.json for support handoff clarity.'
      ],
      notProvenByThisCommand: [
        'Does not prove that the Nimb process is currently running.',
        'Does not prove reverse proxy, shared-host panel routing, or container publish/forward rules.',
        'Does not prove external/public DNS or TLS reachability.'
      ],
      likelyBeyondLocalNimbWhen: [
        'Nimb stays up and local URLs in this report work, but external/admin domain URL still fails.',
        'Platform controls port publish/forward, process manager policy, or panel routing and you cannot inspect/change those settings.',
        'You can describe local bind expectations clearly, but upstream route mapping remains unclear after one bounded retry.'
      ]
    },
    supportHandoff: {
      summary: 'Share this local expectation summary first, then include preflight JSON for environment-specific escalation.',
      payload: {
        projectRoot,
        expectedBindHost: 'all local interfaces (Node listen default host)',
        expectedPort: effectivePort.port,
        expectedAdminBasePath: adminBasePath,
        localUrlsToTryFirst: localUrls,
        installed: systemConfig.installed === true,
        installedAt: systemConfig.installedAt ?? null,
        portSource: effectivePort.source
      },
      exportCommand: 'npx nimb preflight --json > nimb-preflight-report.json'
    }
  };
};

export const formatReachabilityDoctorReport = (report: ReachabilityDoctorReport) => {
  const lines: string[] = [];
  lines.push('Nimb Local Reachability Doctor (local-only)');
  lines.push(`project: ${report.projectRoot}`);
  lines.push('');
  lines.push('Expected startup bind from this machine/process context:');
  lines.push(`- host: ${report.startup.expectedBindHost}`);
  lines.push(`- port: ${report.startup.expectedPort} (${report.startup.portSource})`);
  lines.push(`- admin base path: ${report.startup.expectedAdminBasePath}`);
  lines.push(`- inference note: ${report.startup.bindHostReason}`);
  lines.push('');
  lines.push('Try these local URLs first (same machine/process namespace):');
  for (const url of report.localUrlsToTryFirst) {
    lines.push(`- ${url}`);
  }
  lines.push('');
  lines.push('This command proves (bounded local expectations):');
  for (const item of report.localOnlyBoundary.provenByThisCommand) {
    lines.push(`- ${item}`);
  }
  lines.push('');
  lines.push('This command does NOT prove:');
  for (const item of report.localOnlyBoundary.notProvenByThisCommand) {
    lines.push(`- ${item}`);
  }
  lines.push('');
  lines.push('Likely beyond local Nimb verification when:');
  for (const item of report.localOnlyBoundary.likelyBeyondLocalNimbWhen) {
    lines.push(`- ${item}`);
  }
  lines.push('');
  lines.push('Support handoff payload (copy key facts):');
  lines.push(`- projectRoot: ${report.supportHandoff.payload.projectRoot}`);
  lines.push(`- expectedBindHost: ${report.supportHandoff.payload.expectedBindHost}`);
  lines.push(`- expectedPort: ${report.supportHandoff.payload.expectedPort}`);
  lines.push(`- expectedAdminBasePath: ${report.supportHandoff.payload.expectedAdminBasePath}`);
  lines.push(`- installed: ${report.supportHandoff.payload.installed ? 'yes' : 'no'}`);
  lines.push(`- installedAt: ${report.supportHandoff.payload.installedAt ?? 'null'}`);
  lines.push(`- export preflight JSON: ${report.supportHandoff.exportCommand}`);

  return `${lines.join('\n')}\n`;
};

export const formatReachabilityDoctorReportJson = (report: ReachabilityDoctorReport) => `${JSON.stringify(report, null, 2)}\n`;

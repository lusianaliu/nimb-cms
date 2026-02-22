export class CompatibilityChecker {
  evaluate(resolutionResult) {
    const warnings = [];
    const rejectedPlugins = new Set();

    for (const conflict of resolutionResult.conflicts) {
      if (conflict.type === 'range-mismatch') {
        warnings.push({
          code: 'breaking-mismatch',
          pluginId: conflict.pluginId,
          capability: conflict.capability,
          message: `no provider matches ${conflict.capability}@${conflict.range}`
        });
        rejectedPlugins.add(conflict.pluginId);
        continue;
      }

      if (conflict.type === 'ambiguous-provider') {
        warnings.push({
          code: 'multiple-providers-conflict',
          pluginId: conflict.pluginId,
          capability: conflict.capability,
          message: `ambiguous providers for ${conflict.capability}@${conflict.range}`
        });
        rejectedPlugins.add(conflict.pluginId);
      }
    }

    for (const resolution of resolutionResult.resolutions) {
      const strictDowngrade = resolution.range.startsWith('^0.') && resolution.version !== resolution.range.slice(1);
      if (strictDowngrade) {
        warnings.push({
          code: 'downgrade-safety',
          pluginId: resolution.consumerId,
          capability: resolution.capability,
          message: `selected provider ${resolution.providerId}@${resolution.version} may not be safe for ${resolution.range}`
        });
      }
    }

    return {
      valid: rejectedPlugins.size === 0,
      warnings,
      rejectedPlugins: [...rejectedPlugins].sort((left, right) => left.localeCompare(right))
    };
  }
}

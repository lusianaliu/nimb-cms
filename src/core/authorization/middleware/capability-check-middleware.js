const JSON_HEADER = { 'Content-Type': 'application/json' };

export class CapabilityCheckMiddleware {
  constructor(options) {
    this.logger = options.logger;
    this.permissionRegistry = options.permissionRegistry;
    this.roleManagementService = options.roleManagementService;
  }

  requireCapability(permissionKey, options = {}) {
    return (req, res) => {
      const subjectId = options.resolveSubjectId?.(req);

      if (!subjectId) {
        this.respond(res, 401, options.unauthenticatedPayload ?? {
          error: 'Authentication required'
        });
        return false;
      }

      if (!this.permissionRegistry.has(permissionKey)) {
        this.logger.warn('Requested permission is not registered', { permissionKey });
        this.respond(res, 403, options.forbiddenPayload ?? {
          error: 'Forbidden'
        });
        return false;
      }

      const allowed = this.roleManagementService.subjectHasPermission(subjectId, permissionKey);
      if (!allowed) {
        this.respond(res, 403, options.forbiddenPayload ?? {
          error: 'Forbidden'
        });
        return false;
      }

      return true;
    };
  }

  respond(res, statusCode, payload) {
    res.writeHead(statusCode, JSON_HEADER);
    res.end(JSON.stringify(payload));
  }
}

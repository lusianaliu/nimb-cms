import { jsonResponse } from '../response.ts';

export const createInspectorRoute = ({ runtime }) => {
  let cachedState = null;

  return {
    method: 'GET',
    path: '/inspector',
    handler: () => {
      const inspector = runtime.getInspector();
      if (!cachedState) {
        cachedState = inspector.state();
      }

      return jsonResponse({
        auth: inspector.auth(),
        goals: inspector.goals(),
        orchestrator: inspector.orchestrator(),
        persistence: inspector.persistence(),
        admin: inspector.admin(),
        content: inspector.content(),
        entries: inspector.entries(),
        entryQuery: inspector.entryQuery?.() ?? { totalQueries: 0, lastQuery: null },
        state: cachedState
      });
    }
  };
};

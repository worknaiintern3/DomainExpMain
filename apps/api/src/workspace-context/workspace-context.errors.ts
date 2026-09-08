export class WorkspaceAccessDeniedError extends Error {
  readonly code = 'WORKSPACE_ACCESS_DENIED';

  constructor() {
    super('Workspace access denied');
    this.name = 'WorkspaceAccessDeniedError';
  }
}

export class WorkspaceContextPersistenceError extends Error {
  readonly code = 'WORKSPACE_CONTEXT_PERSISTENCE_ERROR';

  constructor() {
    super('Workspace context could not be resolved');
    this.name = 'WorkspaceContextPersistenceError';
  }
}

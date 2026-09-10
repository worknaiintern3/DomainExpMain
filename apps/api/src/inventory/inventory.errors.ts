export class InventoryWriteForbiddenError extends Error {
  readonly code = 'INVENTORY_WRITE_FORBIDDEN';

  constructor() {
    super('Inventory write access denied');
    this.name = 'InventoryWriteForbiddenError';
  }
}

export class InventoryRecordNotFoundError extends Error {
  readonly code = 'INVENTORY_RECORD_NOT_FOUND';

  constructor() {
    super('Inventory record not found');
    this.name = 'InventoryRecordNotFoundError';
  }
}

export class InventoryConflictError extends Error {
  readonly code = 'INVENTORY_CONFLICT';

  constructor() {
    super('Inventory record conflicts with an existing record');
    this.name = 'InventoryConflictError';
  }
}

export class InvalidInventoryReferenceError extends Error {
  readonly code = 'INVALID_INVENTORY_REFERENCE';

  constructor() {
    super('Invalid inventory reference');
    this.name = 'InvalidInventoryReferenceError';
  }
}

export class InvalidInventoryInputError extends Error {
  readonly code = 'INVALID_INVENTORY_INPUT';

  constructor() {
    super('Invalid inventory input');
    this.name = 'InvalidInventoryInputError';
  }
}

export class InvalidInventoryCursorError extends Error {
  readonly code = 'INVALID_INVENTORY_CURSOR';

  constructor() {
    super('Invalid inventory cursor');
    this.name = 'InvalidInventoryCursorError';
  }
}

export class InventoryPersistenceError extends Error {
  readonly code = 'INVENTORY_PERSISTENCE_ERROR';

  constructor() {
    super('Inventory operation could not be completed');
    this.name = 'InventoryPersistenceError';
  }
}

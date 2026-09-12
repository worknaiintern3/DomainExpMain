export class MonitoringPersistenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MonitoringPersistenceError';
  }
}

export class InvalidMonitoringCursorError extends Error {
  constructor() {
    super('Invalid monitoring cursor');
    this.name = 'InvalidMonitoringCursorError';
  }
}

export class MonitoringTargetNotFoundError extends Error {
  constructor() {
    super('Monitoring target not found');
    this.name = 'MonitoringTargetNotFoundError';
  }
}

export class MonitoringRunNotFoundError extends Error {
  constructor() {
    super('Monitoring run not found');
    this.name = 'MonitoringRunNotFoundError';
  }
}

export class AlertNotFoundError extends Error {
  constructor() {
    super('Alert not found');
    this.name = 'AlertNotFoundError';
  }
}

export class AlertRuleNotFoundError extends Error {
  constructor() {
    super('Alert rule not found');
    this.name = 'AlertRuleNotFoundError';
  }
}

export class AlertAcknowledgeForbiddenError extends Error {
  constructor() {
    super('Alert cannot be acknowledged in its current state');
    this.name = 'AlertAcknowledgeForbiddenError';
  }
}

export class MonitoringWriteForbiddenError extends Error {
  constructor() {
    super('Monitoring write access denied');
    this.name = 'MonitoringWriteForbiddenError';
  }
}

export class ArchivalDomainMonitoringError extends Error {
  constructor() {
    super('Cannot enable monitoring for archived domain');
    this.name = 'ArchivalDomainMonitoringError';
  }
}

export class DisabledTargetManualRunError extends Error {
  constructor() {
    super('Cannot trigger manual run for disabled or unconfigured monitoring target');
    this.name = 'DisabledTargetManualRunError';
  }
}

export class InvalidMonitoringInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidMonitoringInputError';
  }
}
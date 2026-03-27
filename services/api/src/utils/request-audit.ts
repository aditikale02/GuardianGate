type AuditLevel = "info" | "warn" | "error";

export type RequestAuditEvent = {
  request_id: string;
  at: string;
  scope: string;
  level: AuditLevel;
  message: string;
  metadata?: Record<string, unknown>;
};

const MAX_AUDIT_EVENTS = 1000;
const events: RequestAuditEvent[] = [];

export const recordRequestAuditEvent = (event: RequestAuditEvent) => {
  events.push(event);
  if (events.length > MAX_AUDIT_EVENTS) {
    events.shift();
  }
};

export const getRequestAuditTrace = (requestId: string): RequestAuditEvent[] => {
  return events.filter((event) => event.request_id === requestId);
};

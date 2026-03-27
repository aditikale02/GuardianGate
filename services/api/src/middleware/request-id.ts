import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { recordRequestAuditEvent } from "../utils/request-audit";

const REQUEST_ID_HEADER = "x-request-id";

const normalizeRequestId = (value: string | string[] | undefined): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.slice(0, 128);
};

export const attachRequestId = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const incomingRequestId = normalizeRequestId(req.headers[REQUEST_ID_HEADER]);
  const requestId = incomingRequestId ?? randomUUID();

  (req as Request & { requestId?: string }).requestId = requestId;
  res.setHeader(REQUEST_ID_HEADER, requestId);

  recordRequestAuditEvent({
    request_id: requestId,
    at: new Date().toISOString(),
    scope: "http.request",
    level: "info",
    message: "Request started",
    metadata: {
      method: req.method,
      path: req.path,
    },
  });

  next();
};

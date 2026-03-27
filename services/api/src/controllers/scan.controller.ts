import { Response } from "express";
import { EntryAction, ScanValidationStatus } from "@prisma/client";
import { QRTokenSchema } from "@guardian/shared";
import { prisma } from "../prisma";
import { verifyQRToken } from "../utils/qr";
import { consumeNonce } from "../utils/replay";
import { AuthRequest } from "../middleware/auth";
import { getIO } from "../socket";
import { recordRequestAuditEvent } from "../utils/request-audit";

const mapStatus = (action: EntryAction): "ENTRY" | "EXIT" => action;

export const submitScan = async (req: AuthRequest, res: Response) => {
  const requestId = req.requestId ?? "unknown";
  recordRequestAuditEvent({
    request_id: requestId,
    at: new Date().toISOString(),
    scope: "scan.submit",
    level: "info",
    message: "Scan submission received",
  });
  const validation = QRTokenSchema.safeParse(req.body);

  if (!validation.success) {
    recordRequestAuditEvent({
      request_id: requestId,
      at: new Date().toISOString(),
      scope: "scan.submit",
      level: "warn",
      message: "Payload validation failed",
    });
    res.status(400).json({ errors: validation.error.errors });
    return;
  }

  if (!req.user) {
    recordRequestAuditEvent({
      request_id: requestId,
      at: new Date().toISOString(),
      scope: "scan.submit",
      level: "warn",
      message: "Missing authenticated user",
    });
    res.status(401).json({ message: "Not authenticated" });
    return;
  }

  const student = await prisma.student.findUnique({
    where: { user_id: req.user.id },
  });

  if (!student) {
    recordRequestAuditEvent({
      request_id: requestId,
      at: new Date().toISOString(),
      scope: "scan.submit",
      level: "warn",
      message: "Student profile not found",
      metadata: {
        user_id: req.user.id,
      },
    });
    res.status(403).json({ message: "Student profile not found" });
    return;
  }

  const qrPayload = verifyQRToken(validation.data.token);

  if (!qrPayload) {
    recordRequestAuditEvent({
      request_id: requestId,
      at: new Date().toISOString(),
      scope: "scan.validate",
      level: "warn",
      message: "Token validation failed",
      metadata: {
        student_id: student.id,
      },
    });
    const invalidLog = await prisma.entryExitLog.create({
      data: {
        student_id: student.id,
        action_type: student.current_status,
        validation_status: ScanValidationStatus.INVALID_TOKEN,
        failure_reason: "Token validation failed",
      },
      include: {
        student: {
          select: {
            hostel_id: true,
            user: {
              select: {
                full_name: true,
              },
            },
          },
        },
      },
    });

    getIO()?.to("dashboard:overview").emit("scan:invalid", {
      id: invalidLog.id,
      time: invalidLog.timestamp.toISOString(),
      name: invalidLog.student.user.full_name,
      hostel_id: invalidLog.student.hostel_id,
      gate_id: invalidLog.gate_id,
      reason: invalidLog.failure_reason ?? invalidLog.validation_status,
      request_id: requestId,
    });

    res.status(400).json({
      success: false,
      message: "Invalid or expired QR token",
      action_type: mapStatus(student.current_status),
      timestamp: new Date().toISOString(),
      request_id: requestId,
    });
    return;
  }

  const nonceAccepted = consumeNonce(qrPayload.nonce, qrPayload.exp);

  if (!nonceAccepted) {
    recordRequestAuditEvent({
      request_id: requestId,
      at: new Date().toISOString(),
      scope: "scan.validate",
      level: "warn",
      message: "Replay token detected",
      metadata: {
        student_id: student.id,
        gate_id: qrPayload.gate_id,
      },
    });
    const replayLog = await prisma.entryExitLog.create({
      data: {
        student_id: student.id,
        action_type: student.current_status,
        gate_id: qrPayload.gate_id,
        validation_status: ScanValidationStatus.SESSION_ERROR,
        failure_reason: "Replay token detected",
      },
      include: {
        student: {
          select: {
            hostel_id: true,
            user: {
              select: {
                full_name: true,
              },
            },
          },
        },
      },
    });

    getIO()?.to("dashboard:overview").emit("scan:invalid", {
      id: replayLog.id,
      time: replayLog.timestamp.toISOString(),
      name: replayLog.student.user.full_name,
      hostel_id: replayLog.student.hostel_id,
      gate_id: replayLog.gate_id,
      reason: replayLog.failure_reason ?? replayLog.validation_status,
      request_id: requestId,
    });

    res.status(400).json({
      success: false,
      message: "Replay token detected",
      action_type: mapStatus(student.current_status),
      timestamp: new Date().toISOString(),
      request_id: requestId,
    });
    return;
  }

  const nextAction =
    student.current_status === EntryAction.ENTRY
      ? EntryAction.EXIT
      : EntryAction.ENTRY;

  const now = new Date();

  const studentUser = await prisma.user.findUnique({
    where: { id: student.user_id },
    select: { full_name: true },
  });

  await prisma.$transaction([
    prisma.student.update({
      where: { id: student.id },
      data: {
        current_status: nextAction,
        last_scan_at: now,
      },
    }),
    prisma.entryExitLog.create({
      data: {
        student_id: student.id,
        action_type: nextAction,
        timestamp: now,
        gate_id: qrPayload.gate_id,
        validation_status: ScanValidationStatus.SUCCESS,
      },
    }),
  ]);

  recordRequestAuditEvent({
    request_id: requestId,
    at: now.toISOString(),
    scope: "scan.submit",
    level: "info",
    message: "Scan recorded successfully",
    metadata: {
      student_id: student.id,
      action_type: nextAction,
      gate_id: qrPayload.gate_id,
    },
  });

  getIO()?.to("dashboard:overview").emit("scan:recorded", {
    id: `scan-${now.getTime()}`,
    time: now.toISOString(),
    name: studentUser?.full_name ?? "Unknown Student",
    hostel_id: student.hostel_id,
    dir: nextAction === EntryAction.ENTRY ? "IN" : "OUT",
    method: "QR",
    gate_id: qrPayload.gate_id,
    request_id: requestId,
  });

  res.json({
    success: true,
    message:
      nextAction === EntryAction.ENTRY
        ? "Entry recorded successfully"
        : "Exit recorded successfully",
    action_type: mapStatus(nextAction),
    timestamp: now.toISOString(),
    request_id: requestId,
  });
};

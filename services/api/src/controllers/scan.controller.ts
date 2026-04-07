import { Response } from "express";
import { EntryAction, ScanValidationStatus } from "@prisma/client";
import { QRTokenSchema } from "@guardian/shared";
import { prisma } from "../prisma";
import { validateQRToken } from "../utils/qr";
import { consumeNonce } from "../utils/replay";
import { AuthRequest } from "../middleware/auth";
import { recordRequestAuditEvent } from "../utils/request-audit";
import { env } from "../config/env.config";
import { publishRealtimeEvent } from "../services/realtime.service";

const mapStatus = (action: EntryAction): "ENTRY" | "EXIT" => action;

const formatTimeOnly = (value: Date) =>
  `${value.getHours().toString().padStart(2, "0")}:${value
    .getMinutes()
    .toString()
    .padStart(2, "0")}:${value.getSeconds().toString().padStart(2, "0")}`;

const toDateOnlyUtc = (value: Date) =>
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));

const getAllowedCutoffForAction = (action: EntryAction) =>
  action === EntryAction.ENTRY ? env.QR_ENTRY_CUTOFF_TIME : env.QR_EXIT_CUTOFF_TIME;

const calculateEntryLateFlags = (scannedAt: Date) => {
  const action = EntryAction.ENTRY;
  const allowedTime = getAllowedCutoffForAction(action);
  const [hoursRaw, minsRaw] = allowedTime.split(":");
  const cutoff = new Date(scannedAt);
  cutoff.setHours(Number(hoursRaw) || 0, Number(minsRaw) || 0, 0, 0);

  const isLate = scannedAt.getTime() > cutoff.getTime();
  return {
    allowedTime,
    actualScannedTime: formatTimeOnly(scannedAt),
    isLate,
    isFlagged: isLate,
    lateReason: isLate
      ? action === EntryAction.ENTRY
        ? "ENTRY_AFTER_ALLOWED_TIME"
        : "EXIT_AFTER_ALLOWED_TIME"
      : null,
  };
};

const EXIT_DESTINATION_PREFIX = "EXIT_DESTINATION:";
const EXIT_NOTE_PREFIX = "EXIT_NOTE:";

const buildExitRemarks = (destination: string, note?: string | null) => {
  const normalizedDestination = destination.trim();
  const normalizedNote = (note || "").trim();
  const noteSection = normalizedNote ? `${EXIT_NOTE_PREFIX}${normalizedNote}` : "";
  return [
    `${EXIT_DESTINATION_PREFIX}${normalizedDestination}`,
    noteSection,
  ]
    .filter(Boolean)
    .join(" | ");
};

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
    include: {
      user: {
        select: {
          full_name: true,
        },
      },
      room_allocation: {
        include: {
          room: {
            include: {
              floor: true,
            },
          },
        },
      },
    },
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

  const attemptedAction =
    student.current_status === EntryAction.ENTRY ? EntryAction.EXIT : EntryAction.ENTRY;
  const qrValidation = validateQRToken(validation.data.token);
  const qrPayload = qrValidation.payload;

  if (qrValidation.reason !== "SUCCESS" || !qrPayload) {
    const mappedValidationStatus =
      qrValidation.reason === "EXPIRED"
        ? ScanValidationStatus.EXPIRED_TOKEN
        : ScanValidationStatus.INVALID_TOKEN;

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
        action_type: attemptedAction,
        timestamp: new Date(),
        scan_date: toDateOnlyUtc(new Date()),
        scan_time: formatTimeOnly(new Date()),
        qr_generated_at:
          typeof qrPayload?.iat === "number"
            ? new Date(qrPayload.iat * 1000)
            : null,
        qr_expires_at:
          typeof qrPayload?.exp === "number"
            ? new Date(qrPayload.exp * 1000)
            : null,
        validation_status: mappedValidationStatus,
        failure_reason:
          qrValidation.reason === "EXPIRED"
            ? "QR token expired"
            : "Token validation failed",
        verified_by_user_id: qrPayload?.generated_by_user_id ?? null,
        verified_by_role: qrPayload?.generated_by_role ?? null,
        remarks:
          qrValidation.reason === "EXPIRED"
            ? "Expired QR scan attempt"
            : "Invalid QR scan attempt",
        student_name_snapshot: student.user.full_name,
        enrollment_no_snapshot: student.enrollment_no,
        hostel_id_snapshot: student.hostel_id,
        floor_number_snapshot:
          student.room_allocation?.room.floor.floor_number ?? null,
        room_number_snapshot: student.room_allocation?.room.room_number ?? null,
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

    await publishRealtimeEvent("dashboard:overview", "scan:invalid", {
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
      message:
        qrValidation.reason === "EXPIRED"
          ? "Expired QR token"
          : "Invalid QR token",
      status: qrValidation.reason,
      action_type: mapStatus(attemptedAction),
      timestamp: new Date().toISOString(),
      late_status: false,
      flagged_status: false,
      request_id: requestId,
    });
    return;
  }

  const nextAction = attemptedAction;
  const exitDestination = validation.data.exit_destination?.trim();
  const exitNote = validation.data.exit_note?.trim() || null;

  if (nextAction === EntryAction.EXIT && !exitDestination) {
    res.status(400).json({
      success: false,
      message: "Destination is required for exit",
      status: "REQUIRES_EXIT_DETAILS",
      action_type: mapStatus(nextAction),
      requires_exit_details: true,
      timestamp: new Date().toISOString(),
      request_id: requestId,
    });
    return;
  }

  // Scope replay protection per student so one gate QR can be used by multiple students.
  const nonceAccepted = consumeNonce(`${student.id}:${qrPayload.nonce}`, qrPayload.exp);

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
        action_type: attemptedAction,
        timestamp: new Date(),
        scan_date: toDateOnlyUtc(new Date()),
        scan_time: formatTimeOnly(new Date()),
        qr_generated_at: new Date(qrPayload.iat * 1000),
        qr_expires_at: new Date(qrPayload.exp * 1000),
        gate_id: qrPayload.gate_id,
        validation_status: ScanValidationStatus.SESSION_ERROR,
        failure_reason: "Replay token detected",
        verified_by_user_id: qrPayload.generated_by_user_id ?? null,
        verified_by_role: qrPayload.generated_by_role ?? null,
        remarks: "Replay token detected",
        student_name_snapshot: student.user.full_name,
        enrollment_no_snapshot: student.enrollment_no,
        hostel_id_snapshot: student.hostel_id,
        floor_number_snapshot: student.room_allocation?.room.floor.floor_number ?? null,
        room_number_snapshot: student.room_allocation?.room.room_number ?? null,
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

    await publishRealtimeEvent("dashboard:overview", "scan:invalid", {
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
      status: "INVALID",
      action_type: mapStatus(attemptedAction),
      timestamp: new Date().toISOString(),
      late_status: false,
      flagged_status: false,
      request_id: requestId,
    });
    return;
  }

  const now = new Date();
  const lateFlags =
    nextAction === EntryAction.ENTRY
      ? calculateEntryLateFlags(now)
      : {
          allowedTime: null,
          actualScannedTime: formatTimeOnly(now),
          isLate: false,
          isFlagged: false,
          lateReason: null,
        };

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
        scan_date: toDateOnlyUtc(now),
        scan_time: formatTimeOnly(now),
        qr_generated_at: new Date(qrPayload.iat * 1000),
        qr_expires_at: new Date(qrPayload.exp * 1000),
        gate_id: qrPayload.gate_id,
        verified_by_user_id: qrPayload.generated_by_user_id ?? null,
        verified_by_role: qrPayload.generated_by_role ?? null,
        allowed_time: lateFlags.allowedTime,
        actual_scanned_time: lateFlags.actualScannedTime,
        is_late: lateFlags.isLate,
        is_flagged: lateFlags.isFlagged,
        late_reason: lateFlags.lateReason,
        remarks:
          nextAction === EntryAction.EXIT
            ? buildExitRemarks(exitDestination!, exitNote)
            : lateFlags.isLate
              ? "Scan marked late and flagged automatically"
              : "Scan successful",
        student_name_snapshot: student.user.full_name,
        enrollment_no_snapshot: student.enrollment_no,
        hostel_id_snapshot: student.hostel_id,
        floor_number_snapshot: student.room_allocation?.room.floor.floor_number ?? null,
        room_number_snapshot: student.room_allocation?.room.room_number ?? null,
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

  await publishRealtimeEvent("dashboard:overview", "scan:recorded", {
    id: `scan-${now.getTime()}`,
    time: now.toISOString(),
    name: student.user.full_name,
    hostel_id: student.hostel_id,
    dir: nextAction === EntryAction.ENTRY ? "IN" : "OUT",
    method: "QR",
    gate_id: qrPayload.gate_id,
    is_late: lateFlags.isLate,
    is_flagged: lateFlags.isFlagged,
    request_id: requestId,
  });

  res.json({
    success: true,
    message:
      nextAction === EntryAction.ENTRY
        ? "Entry recorded successfully"
        : "Exit recorded successfully",
    status: "SUCCESS",
    action_type: mapStatus(nextAction),
    timestamp: now.toISOString(),
    late_status: lateFlags.isLate,
    flagged_status: lateFlags.isFlagged,
    destination: nextAction === EntryAction.EXIT ? exitDestination : null,
    exit_note: nextAction === EntryAction.EXIT ? exitNote : null,
    request_id: requestId,
  });
};

import { Request, Response } from "express";
import {
  AttendanceStatus,
  EntryAction,
  RequestStatus,
  Role,
  ScanValidationStatus,
} from "@prisma/client";
import { prisma } from "../prisma";
import { getRequestAuditTrace } from "../utils/request-audit";
import { AuthRequest } from "../middleware/auth";

const invalidScanWhere = {
  NOT: {
    validation_status: ScanValidationStatus.SUCCESS,
  },
};

const parsePositiveInt = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
};

const parseIsoDateOnly = (value: unknown) => {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
};

export const getOverview = async (_req: Request, res: Response) => {
  const [
    totalStudents,
    currentlyIn,
    currentlyOut,
    recentLogs,
    invalidScanCount,
    recentInvalidScans,
  ] =
    await prisma.$transaction([
      prisma.student.count(),
      prisma.student.count({ where: { current_status: EntryAction.ENTRY } }),
      prisma.student.count({ where: { current_status: EntryAction.EXIT } }),
      prisma.entryExitLog.findMany({
        take: 20,
        orderBy: { timestamp: "desc" },
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
      }),
      prisma.entryExitLog.count({ where: invalidScanWhere }),
      prisma.entryExitLog.findMany({
        where: invalidScanWhere,
        take: 5,
        orderBy: { timestamp: "desc" },
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
      }),
    ]);

  res.json({
    stats: {
      total: totalStudents,
      in: currentlyIn,
      out: currentlyOut,
    },
    logs: recentLogs.map((log) => ({
      id: log.id,
      time: log.timestamp.toISOString(),
      name: log.student.user.full_name,
      hostel_id: log.student.hostel_id,
      dir: log.action_type === EntryAction.ENTRY ? "IN" : "OUT",
      method: "QR",
      gate_id: log.gate_id,
    })),
    security: {
      invalid_total: invalidScanCount,
      recent_invalid_scans: recentInvalidScans.map((scan) => ({
        id: scan.id,
        time: scan.timestamp.toISOString(),
        name: scan.student.user.full_name,
        hostel_id: scan.student.hostel_id,
        gate_id: scan.gate_id,
        reason: scan.failure_reason ?? scan.validation_status,
      })),
    },
  });
};

export const getAttendance = async (req: Request, res: Response) => {
  const selectedDate = parseIsoDateOnly(req.query.date) ?? new Date();
  const dayStart = new Date(Date.UTC(
    selectedDate.getUTCFullYear(),
    selectedDate.getUTCMonth(),
    selectedDate.getUTCDate(),
  ));
  const nextDay = new Date(dayStart);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);

  const roomPrefixRaw = req.query.room_prefix;
  const roomPrefix =
    typeof roomPrefixRaw === "string" && roomPrefixRaw !== "ALL"
      ? roomPrefixRaw.trim()
      : "";

  const statusRaw = req.query.status;
  const status =
    typeof statusRaw === "string" && statusRaw !== "ALL"
      ? (statusRaw.trim() as AttendanceStatus)
      : null;

  const attendanceRows = await prisma.attendanceRecord.findMany({
    where: {
      attendance_date: {
        gte: dayStart,
        lt: nextDay,
      },
      ...(status ? { attendance_status: status } : {}),
    },
    orderBy: { created_at: "desc" },
    include: {
      student: {
        include: {
          user: {
            select: {
              full_name: true,
            },
          },
          room_allocation: {
            include: {
              room: {
                select: {
                  room_number: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const rows = attendanceRows
    .map((row) => ({
      id: row.id,
      name: row.student.user.full_name,
      room: row.student.room_allocation?.room.room_number ?? "N/A",
      status: row.attendance_status,
      remarks:
        row.warden_remark ??
        (row.is_on_approved_leave
          ? "Approved leave"
          : row.late_return_flag
            ? "Late return"
            : ""),
    }))
    .filter((row) => (roomPrefix ? row.room.startsWith(roomPrefix) : true));

  const summary = {
    present: rows.filter((item) => item.status === AttendanceStatus.PRESENT).length,
    on_leave: rows.filter((item) => item.status === AttendanceStatus.ON_LEAVE).length,
    absent: rows.filter((item) => item.status === AttendanceStatus.ABSENT).length,
    late_return: rows.filter((item) => item.status === AttendanceStatus.LATE_RETURN).length,
  };

  res.json({
    date: dayStart.toISOString().slice(0, 10),
    summary,
    rows,
  });
};

export const getLogs = async (req: Request, res: Response) => {
  const page = parsePositiveInt(req.query.page, 1);
  const pageSize = Math.min(parsePositiveInt(req.query.page_size, 10), 50);
  const skip = (page - 1) * pageSize;

  const searchRaw = req.query.search;
  const search = typeof searchRaw === "string" ? searchRaw.trim() : "";

  const directionRaw = req.query.direction;
  const direction =
    directionRaw === "IN"
      ? EntryAction.ENTRY
      : directionRaw === "OUT"
        ? EntryAction.EXIT
        : null;

  const gateRaw = req.query.gate;
  const gate =
    typeof gateRaw === "string" && gateRaw !== "ALL" ? gateRaw.trim() : "";

  const where = {
    ...(direction ? { action_type: direction } : {}),
    ...(gate ? { gate_id: gate } : {}),
    ...(search
      ? {
          OR: [
            {
              student: {
                user: {
                  full_name: {
                    contains: search,
                    mode: "insensitive" as const,
                  },
                },
              },
            },
            {
              student: {
                hostel_id: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
            },
          ],
        }
      : {}),
  };

  const [total, logs, gateValues] = await prisma.$transaction([
    prisma.entryExitLog.count({ where }),
    prisma.entryExitLog.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { timestamp: "desc" },
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
    }),
    prisma.entryExitLog.findMany({
      where: { gate_id: { not: null } },
      distinct: ["gate_id"],
      select: { gate_id: true },
    }),
  ]);

  res.json({
    page,
    page_size: pageSize,
    total,
    total_pages: Math.max(1, Math.ceil(total / pageSize)),
    gates: gateValues.map((row) => row.gate_id).filter(Boolean),
    rows: logs.map((log) => ({
      id: log.id,
      time: log.timestamp.toISOString(),
      name: log.student.user.full_name,
      hostel_id: log.student.hostel_id,
      dir: log.action_type === EntryAction.ENTRY ? "IN" : "OUT",
      gate_id: log.gate_id,
      method: "QR",
      request_id: undefined,
    })),
  });
};

export const getRequests = async (_req: Request, res: Response) => {
  const [leaveRequests, guestRequests] = await prisma.$transaction([
    prisma.nightLeaveRequest.findMany({
      orderBy: { created_at: "desc" },
      take: 20,
      include: {
        student: {
          include: {
            user: {
              select: {
                full_name: true,
              },
            },
          },
        },
      },
    }),
    prisma.guestRequest.findMany({
      orderBy: { created_at: "desc" },
      take: 20,
      include: {
        student: {
          include: {
            user: {
              select: {
                full_name: true,
              },
            },
          },
        },
      },
    }),
  ]);

  const mappedLeave = leaveRequests.map((request) => ({
    id: request.id,
    student: request.student.user.full_name,
    type: "LEAVE",
    submitted_at: request.created_at.toISOString(),
    status: request.status,
  }));

  const mappedGuest = guestRequests.map((request) => ({
    id: request.id,
    student: request.student.user.full_name,
    type: "GUEST",
    submitted_at: request.created_at.toISOString(),
    status: request.status,
  }));

  const rows = [...mappedLeave, ...mappedGuest].sort(
    (left, right) =>
      new Date(right.submitted_at).getTime() -
      new Date(left.submitted_at).getTime(),
  );

  res.json({
    summary: {
      pending: rows.filter((item) => item.status === RequestStatus.PENDING).length,
      approved: rows.filter((item) => item.status === RequestStatus.APPROVED).length,
      rejected: rows.filter((item) => item.status === RequestStatus.REJECTED).length,
    },
    rows,
  });
};

export const getNotifications = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }

  const notifications = await prisma.notification.findMany({
    where: {
      recipient_id: userId,
    },
    orderBy: { created_at: "desc" },
    take: 30,
  });

  const rows = notifications.map((notification) => ({
    id: notification.id,
    title: notification.title,
    message: notification.message,
    level:
      notification.type === "EMERGENCY_ALERT"
        ? "CRITICAL"
        : notification.type === "LEAVE_REJECTION" ||
            notification.type === "GUEST_REJECTION"
          ? "WARNING"
          : "INFO",
    at: notification.created_at.toISOString(),
    read: notification.is_read,
  }));

  res.json({
    unread: rows.filter((item) => !item.read).length,
    rows,
  });
};

export const markNotificationRead = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }

  const notificationIdRaw = req.params.notificationId;
  const notificationId =
    typeof notificationIdRaw === "string" ? notificationIdRaw.trim() : "";

  if (!notificationId) {
    res.status(400).json({ message: "notificationId is required" });
    return;
  }

  const existing = await prisma.notification.findFirst({
    where: {
      id: notificationId,
      recipient_id: userId,
    },
    select: {
      id: true,
      is_read: true,
    },
  });

  if (!existing) {
    res.status(404).json({ message: "Notification not found" });
    return;
  }

  if (existing.is_read) {
    res.json({ id: existing.id, read: true });
    return;
  }

  const updated = await prisma.notification.update({
    where: { id: existing.id },
    data: { is_read: true },
    select: {
      id: true,
      is_read: true,
    },
  });

  res.json({ id: updated.id, read: updated.is_read });
};

export const markAllNotificationsRead = async (
  req: AuthRequest,
  res: Response,
) => {
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }

  const result = await prisma.notification.updateMany({
    where: {
      recipient_id: userId,
      is_read: false,
    },
    data: {
      is_read: true,
    },
  });

  res.json({ updated: result.count });
};

export const getReports = async (_req: Request, res: Response) => {
  const [presentCount, leaveCount, absentCount, lateCount, invalidScans] =
    await prisma.$transaction([
      prisma.attendanceRecord.count({
        where: { attendance_status: AttendanceStatus.PRESENT },
      }),
      prisma.attendanceRecord.count({
        where: { attendance_status: AttendanceStatus.ON_LEAVE },
      }),
      prisma.attendanceRecord.count({
        where: { attendance_status: AttendanceStatus.ABSENT },
      }),
      prisma.attendanceRecord.count({
        where: { attendance_status: AttendanceStatus.LATE_RETURN },
      }),
      prisma.entryExitLog.count({ where: invalidScanWhere }),
    ]);

  const total = Math.max(1, presentCount + leaveCount + absentCount + lateCount);

  res.json({
    weekly_attendance_percent: Math.round((presentCount / total) * 100),
    monthly_attendance_percent: Math.round(((presentCount + leaveCount) / total) * 100),
    late_returns: lateCount,
    invalid_scans: invalidScans,
  });
};

export const getStudents = async (_req: Request, res: Response) => {
  const students = await prisma.student.findMany({
    orderBy: { created_at: "desc" },
    include: {
      user: {
        select: {
          full_name: true,
        },
      },
      room_allocation: {
        include: {
          room: {
            select: {
              room_number: true,
            },
          },
        },
      },
    },
    take: 200,
  });

  res.json({
    rows: students.map((student) => ({
      id: student.id,
      name: student.user.full_name,
      room: student.room_allocation?.room.room_number ?? "N/A",
      status: student.current_status === EntryAction.ENTRY ? "IN" : "OUT",
      hostel_id: student.hostel_id,
    })),
  });
};

export const getWardens = async (_req: Request, res: Response) => {
  const wardens = await prisma.user.findMany({
    where: {
      role: {
        in: [Role.WARDEN, Role.ADMIN],
      },
      is_active: true,
    },
    select: {
      id: true,
      full_name: true,
      email: true,
      role: true,
      created_at: true,
    },
    orderBy: { created_at: "asc" },
  });

  res.json({
    rows: wardens.map((warden) => ({
      id: warden.id,
      name: warden.full_name,
      email: warden.email,
      role: warden.role,
      shift: "Operational",
    })),
  });
};

export const getSettings = async (_req: Request, res: Response) => {
  res.json({
    default_gate: "G-01",
    attendance_cutoff_time: "22:00",
    alert_email: "alerts@guardian.com",
  });
};

export const getProfile = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }

  res.json({
    id: req.user.id,
    name: req.user.full_name,
    email: req.user.email,
    role: req.user.role,
    first_login: req.user.first_login,
    is_active: req.user.is_active,
  });
};

export const getRequestTrace = (req: Request, res: Response) => {
  const requestIdRaw = req.query.request_id;
  const requestId = typeof requestIdRaw === "string" ? requestIdRaw.trim() : "";

  if (!requestId) {
    res.status(400).json({ message: "request_id query parameter is required" });
    return;
  }

  const trace = getRequestAuditTrace(requestId);

  res.json({
    request_id: requestId,
    events: trace,
  });
};

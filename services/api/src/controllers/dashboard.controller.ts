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

const parseBooleanFlag = (value: unknown): boolean | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "yes" || normalized === "1") {
    return true;
  }
  if (normalized === "false" || normalized === "no" || normalized === "0") {
    return false;
  }
  return null;
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

const parseFloorNumber = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return null;
  return parsed;
};

const EXIT_DESTINATION_PREFIX = "EXIT_DESTINATION:";
const EXIT_NOTE_PREFIX = "EXIT_NOTE:";

const parseExitDetailsFromRemarks = (remarks?: string | null) => {
  if (!remarks) {
    return { destination: null as string | null, exit_note: null as string | null };
  }

  const segments = remarks.split("|").map((segment) => segment.trim());
  const destinationSegment = segments.find((segment) =>
    segment.startsWith(EXIT_DESTINATION_PREFIX),
  );
  const noteSegment = segments.find((segment) => segment.startsWith(EXIT_NOTE_PREFIX));

  const destination = destinationSegment
    ? destinationSegment.slice(EXIT_DESTINATION_PREFIX.length).trim() || null
    : null;
  const exit_note = noteSegment
    ? noteSegment.slice(EXIT_NOTE_PREFIX.length).trim() || null
    : null;

  return { destination, exit_note };
};

const parseAttendanceStatusValue = (value: unknown): AttendanceStatus | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  if (normalized === "LEAVE") return AttendanceStatus.ON_LEAVE;
  if (normalized === "LATE_ENTRY") return AttendanceStatus.LATE_RETURN;
  if (normalized === AttendanceStatus.PRESENT) return AttendanceStatus.PRESENT;
  if (normalized === AttendanceStatus.ABSENT) return AttendanceStatus.ABSENT;
  if (normalized === AttendanceStatus.ON_LEAVE) return AttendanceStatus.ON_LEAVE;
  if (normalized === AttendanceStatus.LATE_RETURN) return AttendanceStatus.LATE_RETURN;
  return null;
};

export const getAttendanceFloorOptions = async (_req: Request, res: Response) => {
  const blocks = await prisma.hostelBlock.findMany({
    orderBy: { name: "asc" },
    include: {
      floors: {
        orderBy: { floor_number: "asc" },
        include: {
          _count: {
            select: { rooms: true },
          },
        },
      },
    },
  });

  res.json({
    hostels: blocks.map((block) => ({
      id: block.id,
      name: block.name,
      floors: block.floors.map((floor) => ({
        floor_number: floor.floor_number,
        room_count: floor._count.rooms,
      })),
    })),
    sessions: ["NIGHT"],
  });
};

export const getFloorAttendance = async (req: Request, res: Response) => {
  const hostelIdRaw = req.query.hostel_id;
  const floorRaw = req.query.floor;
  const dateRaw = req.query.date;
  const sessionRaw = req.query.session;

  const hostelId = typeof hostelIdRaw === "string" ? hostelIdRaw.trim() : "";
  const floorNumber = parseFloorNumber(floorRaw);
  const selectedDate = parseIsoDateOnly(dateRaw);
  const session = typeof sessionRaw === "string" ? sessionRaw.trim().toUpperCase() : "";

  if (!hostelId || floorNumber === null || !selectedDate) {
    res.status(400).json({ message: "hostel_id, floor and date are required" });
    return;
  }

  if (session && session !== "NIGHT") {
    res.status(400).json({ message: "Only NIGHT attendance session is supported" });
    return;
  }

  const dayStart = new Date(Date.UTC(
    selectedDate.getUTCFullYear(),
    selectedDate.getUTCMonth(),
    selectedDate.getUTCDate(),
  ));

  const block = await prisma.hostelBlock.findUnique({
    where: { id: hostelId },
    select: { id: true, name: true },
  });

  if (!block) {
    res.status(404).json({ message: "Hostel not found" });
    return;
  }

  const floor = await prisma.floor.findFirst({
    where: {
      block_id: block.id,
      floor_number: floorNumber,
    },
    select: {
      id: true,
      floor_number: true,
      name: true,
      block: {
        select: { id: true, name: true },
      },
    },
  });

  if (!floor) {
    res.status(404).json({ message: "Floor not found for selected hostel" });
    return;
  }

  const rooms = await prisma.room.findMany({
    where: {
      floor_id: floor.id,
    },
    orderBy: { room_number: "asc" },
    include: {
      allocations: {
        where: { is_active: true },
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
        orderBy: { bed_number: "asc" },
      },
    },
  });

  const studentIds = rooms.flatMap((room) => room.allocations.map((allocation) => allocation.student.id));

  const attendanceRows = studentIds.length
    ? await prisma.attendanceRecord.findMany({
        where: {
          student_id: { in: studentIds },
          attendance_date: dayStart,
        },
      })
    : [];

  const attendanceByStudentId = new Map(attendanceRows.map((row) => [row.student_id, row]));

  const roomRows = rooms.map((room) => {
    const students = room.allocations.map((allocation) => {
      const attendance = attendanceByStudentId.get(allocation.student.id);
      const markedStatus = attendance?.attendance_status ?? null;
      return {
        student_id: allocation.student.id,
        attendance_id: attendance?.id ?? null,
        name: allocation.student.user.full_name,
        enrollment_no: allocation.student.enrollment_no,
        hostel_id: allocation.student.hostel_id,
        bed_number: allocation.bed_number,
        status: markedStatus,
        remarks: attendance?.warden_remark ?? "",
        marked_time: attendance?.updated_at.toISOString() ?? null,
      };
    });

    const summary = {
      total: students.length,
      present: students.filter((student) => student.status === AttendanceStatus.PRESENT).length,
      absent: students.filter((student) => student.status === AttendanceStatus.ABSENT).length,
      on_leave: students.filter((student) => student.status === AttendanceStatus.ON_LEAVE).length,
      late_return: students.filter((student) => student.status === AttendanceStatus.LATE_RETURN).length,
      pending: students.filter((student) => !student.status).length,
    };

    return {
      room_id: room.id,
      room_number: room.room_number,
      status: room.status,
      total_students: students.length,
      summary,
      students,
    };
  });

  const floorSummary = {
    total_rooms: roomRows.length,
    total_students: roomRows.reduce((acc, room) => acc + room.total_students, 0),
    pending_students: roomRows.reduce((acc, room) => acc + room.summary.pending, 0),
    present: roomRows.reduce((acc, room) => acc + room.summary.present, 0),
    absent: roomRows.reduce((acc, room) => acc + room.summary.absent, 0),
    on_leave: roomRows.reduce((acc, room) => acc + room.summary.on_leave, 0),
    late_return: roomRows.reduce((acc, room) => acc + room.summary.late_return, 0),
  };

  res.json({
    filters: {
      hostel_id: block.id,
      hostel_name: block.name,
      floor_number: floor.floor_number,
      date: dayStart.toISOString().slice(0, 10),
      session: "NIGHT",
    },
    summary: floorSummary,
    rooms: roomRows,
  });
};

export const saveFloorAttendance = async (req: AuthRequest, res: Response) => {
  if (!req.user || (req.user.role !== Role.WARDEN && req.user.role !== Role.ADMIN)) {
    res.status(403).json({ message: "Insufficient permissions" });
    return;
  }

  const body = req.body as {
    hostel_id?: string;
    floor_number?: number;
    date?: string;
    session?: string;
    updates?: Array<{
      student_id?: string;
      status?: string;
      remarks?: string;
    }>;
  };

  const hostelId = typeof body.hostel_id === "string" ? body.hostel_id.trim() : "";
  const floorNumber = parseFloorNumber(body.floor_number);
  const selectedDate = parseIsoDateOnly(body.date);
  const session = typeof body.session === "string" ? body.session.trim().toUpperCase() : "";
  const updates = Array.isArray(body.updates) ? body.updates : [];

  if (!hostelId || floorNumber === null || !selectedDate) {
    res.status(400).json({ message: "hostel_id, floor_number and date are required" });
    return;
  }

  if (session !== "NIGHT") {
    res.status(400).json({ message: "Attendance session must be NIGHT" });
    return;
  }

  if (updates.length === 0) {
    res.status(400).json({ message: "No attendance updates provided" });
    return;
  }

  const dayStart = new Date(Date.UTC(
    selectedDate.getUTCFullYear(),
    selectedDate.getUTCMonth(),
    selectedDate.getUTCDate(),
  ));

  const floor = await prisma.floor.findFirst({
    where: {
      block_id: hostelId,
      floor_number: floorNumber,
    },
    select: { id: true },
  });

  if (!floor) {
    res.status(404).json({ message: "Floor not found for selected hostel" });
    return;
  }

  const activeAllocations = await prisma.roomAllocation.findMany({
    where: {
      is_active: true,
      room: {
        floor_id: floor.id,
      },
    },
    select: {
      student_id: true,
    },
  });

  const validStudentIds = new Set(activeAllocations.map((item) => item.student_id));

  const dedupe = new Map<string, { status: AttendanceStatus; remarks: string }>();
  for (const update of updates) {
    const studentId = typeof update.student_id === "string" ? update.student_id.trim() : "";
    const parsedStatus = parseAttendanceStatusValue(update.status);
    if (!studentId || !parsedStatus) {
      res.status(400).json({ message: "Each update requires valid student_id and status" });
      return;
    }
    if (!validStudentIds.has(studentId)) {
      res.status(400).json({ message: "One or more students do not belong to the selected floor" });
      return;
    }
    if (dedupe.has(studentId)) {
      res.status(400).json({ message: "Duplicate attendance update for same student" });
      return;
    }
    dedupe.set(studentId, {
      status: parsedStatus,
      remarks: typeof update.remarks === "string" ? update.remarks.trim().slice(0, 500) : "",
    });
  }

  const entries = Array.from(dedupe.entries());

  await prisma.$transaction(async (tx) => {
    for (const [studentId, payload] of entries) {
      await tx.attendanceRecord.upsert({
        where: {
          student_id_attendance_date: {
            student_id: studentId,
            attendance_date: dayStart,
          },
        },
        create: {
          student_id: studentId,
          attendance_date: dayStart,
          attendance_status: payload.status,
          is_on_approved_leave: payload.status === AttendanceStatus.ON_LEAVE,
          late_return_flag: payload.status === AttendanceStatus.LATE_RETURN,
          manual_override_flag: true,
          warden_remark: payload.remarks || null,
          verified_by_warden_id: req.user!.id,
          is_finalized: true,
          finalized_at: new Date(),
        },
        update: {
          attendance_status: payload.status,
          is_on_approved_leave: payload.status === AttendanceStatus.ON_LEAVE,
          late_return_flag: payload.status === AttendanceStatus.LATE_RETURN,
          manual_override_flag: true,
          warden_remark: payload.remarks || null,
          verified_by_warden_id: req.user!.id,
          is_finalized: true,
          finalized_at: new Date(),
        },
      });
    }
  });

  res.json({
    message: "Attendance saved successfully",
    updated_count: entries.length,
    date: dayStart.toISOString().slice(0, 10),
    session: "NIGHT",
  });
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
  const pageSize = Math.min(parsePositiveInt(req.query.page_size, 20), 100);
  const skip = (page - 1) * pageSize;

  const studentName =
    typeof req.query.student_name === "string" ? req.query.student_name.trim() : "";
  const enrollmentNo =
    typeof req.query.enrollment_no === "string" ? req.query.enrollment_no.trim() : "";
  const hostelId =
    typeof req.query.hostel === "string" ? req.query.hostel.trim() : "";
  const floorRaw =
    typeof req.query.floor === "string" ? req.query.floor.trim() : "";
  const room =
    typeof req.query.room === "string" ? req.query.room.trim() : "";
  const gate =
    typeof req.query.gate === "string" && req.query.gate !== "ALL"
      ? req.query.gate.trim()
      : "";
  const directionRaw = req.query.direction;
  const direction =
    directionRaw === "IN"
      ? EntryAction.ENTRY
      : directionRaw === "OUT"
        ? EntryAction.EXIT
        : null;

  const fromDate = parseIsoDateOnly(req.query.from_date);
  const toDate = parseIsoDateOnly(req.query.to_date);
  const isLate = parseBooleanFlag(req.query.late_status);
  const isFlagged = parseBooleanFlag(req.query.flagged_status);

  const where: any = {};

  if (direction) {
    where.action_type = direction;
  }
  if (gate) {
    where.gate_id = gate;
  }
  if (studentName) {
    where.student_name_snapshot = {
      contains: studentName,
      mode: "insensitive",
    };
  }
  if (enrollmentNo) {
    where.enrollment_no_snapshot = {
      contains: enrollmentNo,
      mode: "insensitive",
    };
  }
  if (hostelId) {
    where.hostel_id_snapshot = {
      contains: hostelId,
      mode: "insensitive",
    };
  }
  if (room) {
    where.room_number_snapshot = {
      contains: room,
      mode: "insensitive",
    };
  }
  if (floorRaw) {
    const floorNumber = Number(floorRaw);
    if (Number.isFinite(floorNumber)) {
      where.floor_number_snapshot = floorNumber;
    }
  }
  if (typeof isLate === "boolean") {
    where.is_late = isLate;
  }
  if (typeof isFlagged === "boolean") {
    where.is_flagged = isFlagged;
  }
  if (fromDate || toDate) {
    where.scan_date = {
      ...(fromDate ? { gte: fromDate } : {}),
      ...(toDate
        ? {
            lte: new Date(
              Date.UTC(
                toDate.getUTCFullYear(),
                toDate.getUTCMonth(),
                toDate.getUTCDate(),
                23,
                59,
                59,
                999,
              ),
            ),
          }
        : {}),
    };
  }

  const today = new Date();
  const todayStart = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  );
  const todayEnd = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 23, 59, 59, 999),
  );

  const [
    total,
    logs,
    gateValues,
    todayEntries,
    todayExits,
    todayLateEntries,
    todayFlagged,
    recentScanActivity,
    filteredLogsForHistory,
  ] = await prisma.$transaction([
    prisma.entryExitLog.count({ where }),
    prisma.entryExitLog.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { timestamp: "desc" },
    }),
    prisma.entryExitLog.findMany({
      where: { gate_id: { not: null } },
      distinct: ["gate_id"],
      select: { gate_id: true },
    }),
    prisma.entryExitLog.count({
      where: {
        scan_date: { gte: todayStart, lte: todayEnd },
        action_type: EntryAction.ENTRY,
        validation_status: ScanValidationStatus.SUCCESS,
      },
    }),
    prisma.entryExitLog.count({
      where: {
        scan_date: { gte: todayStart, lte: todayEnd },
        action_type: EntryAction.EXIT,
        validation_status: ScanValidationStatus.SUCCESS,
      },
    }),
    prisma.entryExitLog.count({
      where: {
        scan_date: { gte: todayStart, lte: todayEnd },
        action_type: EntryAction.ENTRY,
        is_late: true,
        validation_status: ScanValidationStatus.SUCCESS,
      },
    }),
    prisma.entryExitLog.count({
      where: {
        scan_date: { gte: todayStart, lte: todayEnd },
        is_flagged: true,
      },
    }),
    prisma.entryExitLog.findMany({
      where: {
        scan_date: { gte: todayStart, lte: todayEnd },
      },
      take: 15,
      orderBy: { timestamp: "desc" },
      select: {
        id: true,
        timestamp: true,
        action_type: true,
        student_name_snapshot: true,
        enrollment_no_snapshot: true,
        hostel_id_snapshot: true,
        room_number_snapshot: true,
        is_late: true,
        is_flagged: true,
        validation_status: true,
      },
    }),
    prisma.entryExitLog.findMany({
      where,
      take: 5000,
      orderBy: { timestamp: "desc" },
      select: {
        id: true,
        timestamp: true,
        scan_date: true,
        action_type: true,
        student_id: true,
        student_name_snapshot: true,
        enrollment_no_snapshot: true,
        hostel_id_snapshot: true,
        floor_number_snapshot: true,
        room_number_snapshot: true,
        is_late: true,
        is_flagged: true,
      },
    }),
  ]);

  const studentHistoryMap = new Map<
    string,
    {
      student_id: string;
      student_name: string;
      enrollment_no: string;
      total_scans: number;
      entries: number;
      exits: number;
      late_count: number;
      flagged_count: number;
      last_scan_time: string;
    }
  >();

  const roomHistoryMap = new Map<
    string,
    {
      hostel: string;
      floor: number | null;
      room: string;
      total_scans: number;
      entries: number;
      exits: number;
      late_count: number;
      flagged_count: number;
    }
  >();

  const floorHistoryMap = new Map<
    string,
    {
      hostel: string;
      floor: number | null;
      total_scans: number;
      entries: number;
      exits: number;
      late_count: number;
      flagged_count: number;
    }
  >();

  const dateHistoryMap = new Map<
    string,
    {
      date: string;
      total_scans: number;
      entries: number;
      exits: number;
      late_count: number;
      flagged_count: number;
    }
  >();

  for (const log of filteredLogsForHistory) {
    const studentKey = log.student_id;
    const roomKey = `${log.hostel_id_snapshot || ""}|${String(log.floor_number_snapshot ?? "")}|${
      log.room_number_snapshot || ""
    }`;
    const floorKey = `${log.hostel_id_snapshot || ""}|${String(log.floor_number_snapshot ?? "")}`;
    const dateKey = (log.scan_date ?? log.timestamp).toISOString().slice(0, 10);

    if (!studentHistoryMap.has(studentKey)) {
      studentHistoryMap.set(studentKey, {
        student_id: log.student_id,
        student_name: log.student_name_snapshot || "Unknown Student",
        enrollment_no: log.enrollment_no_snapshot || "N/A",
        total_scans: 0,
        entries: 0,
        exits: 0,
        late_count: 0,
        flagged_count: 0,
        last_scan_time: log.timestamp.toISOString(),
      });
    }
    const studentItem = studentHistoryMap.get(studentKey)!;
    studentItem.total_scans += 1;
    if (log.action_type === EntryAction.ENTRY) studentItem.entries += 1;
    if (log.action_type === EntryAction.EXIT) studentItem.exits += 1;
    if (log.is_late) studentItem.late_count += 1;
    if (log.is_flagged) studentItem.flagged_count += 1;

    if (!roomHistoryMap.has(roomKey)) {
      roomHistoryMap.set(roomKey, {
        hostel: log.hostel_id_snapshot || "N/A",
        floor: log.floor_number_snapshot,
        room: log.room_number_snapshot || "N/A",
        total_scans: 0,
        entries: 0,
        exits: 0,
        late_count: 0,
        flagged_count: 0,
      });
    }
    const roomItem = roomHistoryMap.get(roomKey)!;
    roomItem.total_scans += 1;
    if (log.action_type === EntryAction.ENTRY) roomItem.entries += 1;
    if (log.action_type === EntryAction.EXIT) roomItem.exits += 1;
    if (log.is_late) roomItem.late_count += 1;
    if (log.is_flagged) roomItem.flagged_count += 1;

    if (!floorHistoryMap.has(floorKey)) {
      floorHistoryMap.set(floorKey, {
        hostel: log.hostel_id_snapshot || "N/A",
        floor: log.floor_number_snapshot,
        total_scans: 0,
        entries: 0,
        exits: 0,
        late_count: 0,
        flagged_count: 0,
      });
    }
    const floorItem = floorHistoryMap.get(floorKey)!;
    floorItem.total_scans += 1;
    if (log.action_type === EntryAction.ENTRY) floorItem.entries += 1;
    if (log.action_type === EntryAction.EXIT) floorItem.exits += 1;
    if (log.is_late) floorItem.late_count += 1;
    if (log.is_flagged) floorItem.flagged_count += 1;

    if (!dateHistoryMap.has(dateKey)) {
      dateHistoryMap.set(dateKey, {
        date: dateKey,
        total_scans: 0,
        entries: 0,
        exits: 0,
        late_count: 0,
        flagged_count: 0,
      });
    }
    const dateItem = dateHistoryMap.get(dateKey)!;
    dateItem.total_scans += 1;
    if (log.action_type === EntryAction.ENTRY) dateItem.entries += 1;
    if (log.action_type === EntryAction.EXIT) dateItem.exits += 1;
    if (log.is_late) dateItem.late_count += 1;
    if (log.is_flagged) dateItem.flagged_count += 1;
  }

  res.json({
    page,
    page_size: pageSize,
    total,
    total_pages: Math.max(1, Math.ceil(total / pageSize)),
    gates: gateValues.map((row) => row.gate_id).filter(Boolean),
    summary: {
      total_entries_today: todayEntries,
      total_exits_today: todayExits,
      total_late_entries_today: todayLateEntries,
      total_flagged_today: todayFlagged,
    },
    recent_scan_activity: recentScanActivity.map((item) => ({
      id: item.id,
      student_name: item.student_name_snapshot || "Unknown Student",
      enrollment_no: item.enrollment_no_snapshot || "N/A",
      hostel: item.hostel_id_snapshot || "N/A",
      room: item.room_number_snapshot || "N/A",
      scan_type: item.action_type,
      scan_time: item.timestamp.toISOString(),
      status: item.validation_status,
      late_status: item.is_late,
      flagged_status: item.is_flagged,
    })),
    rows: logs.map((log) => {
      const exitDetails = parseExitDetailsFromRemarks(log.remarks);

      return {
        id: log.id,
        student_id: log.student_id,
        student_name: log.student_name_snapshot || "Unknown Student",
        enrollment_no: log.enrollment_no_snapshot || "N/A",
        hostel: log.hostel_id_snapshot || "N/A",
        floor: log.floor_number_snapshot,
        room: log.room_number_snapshot || "N/A",
        scan_type: log.action_type,
        scan_date: log.scan_date?.toISOString().slice(0, 10) || log.timestamp.toISOString().slice(0, 10),
        scan_time: log.scan_time || log.timestamp.toISOString(),
        qr_generated_time: log.qr_generated_at?.toISOString() || null,
        qr_expiry_time: log.qr_expires_at?.toISOString() || null,
        status: log.validation_status,
        verified_by: log.verified_by_role || "UNKNOWN",
        verified_by_user_id: log.verified_by_user_id || null,
        destination: log.action_type === EntryAction.EXIT ? exitDetails.destination : null,
        exit_note: log.action_type === EntryAction.EXIT ? exitDetails.exit_note : null,
        remarks: log.remarks || log.failure_reason || "",
        allowed_time: log.allowed_time || null,
        actual_scanned_time: log.actual_scanned_time || null,
        late_status: log.is_late,
        flagged_status: log.is_flagged,
        late_reason: log.late_reason || null,
        time: log.timestamp.toISOString(),
        gate_id: log.gate_id,
        method: "QR",
        request_id: undefined,
      };
    }),
    student_wise_history: Array.from(studentHistoryMap.values()).sort(
      (a, b) => b.total_scans - a.total_scans,
    ),
    room_wise_history: Array.from(roomHistoryMap.values()).sort(
      (a, b) => b.total_scans - a.total_scans,
    ),
    floor_wise_history: Array.from(floorHistoryMap.values()).sort(
      (a, b) => b.total_scans - a.total_scans,
    ),
    date_wise_history: Array.from(dateHistoryMap.values()).sort((a, b) =>
      a.date < b.date ? 1 : -1,
    ),
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

export const getReports = async (req: Request, res: Response) => {
  const periodRaw =
    typeof req.query.period === "string" ? req.query.period.toLowerCase() : "weekly";
  const period =
    periodRaw === "weekly" || periodRaw === "monthly" || periodRaw === "yearly"
      ? periodRaw
      : "weekly";

  const toDateOnly = parseIsoDateOnly(req.query.to) ?? new Date();
  const fromDateOnly = parseIsoDateOnly(req.query.from);

  const end = new Date(
    Date.UTC(toDateOnly.getUTCFullYear(), toDateOnly.getUTCMonth(), toDateOnly.getUTCDate()),
  );
  const start = fromDateOnly
    ? new Date(
        Date.UTC(
          fromDateOnly.getUTCFullYear(),
          fromDateOnly.getUTCMonth(),
          fromDateOnly.getUTCDate(),
        ),
      )
    : (() => {
        const fallback = new Date(end);
        if (period === "weekly") fallback.setUTCDate(fallback.getUTCDate() - 6);
        if (period === "monthly") fallback.setUTCDate(fallback.getUTCDate() - 29);
        if (period === "yearly") fallback.setUTCDate(fallback.getUTCDate() - 364);
        return fallback;
      })();

  const endExclusive = new Date(end);
  endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);

  const [
    attendanceRows,
    invalidScans,
    leaveCount,
    guestCount,
    eventCount,
    noticeCount,
    emergencyCount,
    feeRows,
    paymentRows,
    occupancyRooms,
    activeAllocations,
    studentsTotal,
    admissions,
  ] = await prisma.$transaction([
    prisma.attendanceRecord.findMany({
      where: {
        attendance_date: {
          gte: start,
          lt: endExclusive,
        },
      },
      select: {
        attendance_date: true,
        attendance_status: true,
      },
    }),
    prisma.entryExitLog.count({
      where: {
        ...invalidScanWhere,
        timestamp: {
          gte: start,
          lt: endExclusive,
        },
      },
    }),
    prisma.nightLeaveRequest.count({
      where: {
        created_at: {
          gte: start,
          lt: endExclusive,
        },
      },
    }),
    prisma.guestRequest.count({
      where: {
        created_at: {
          gte: start,
          lt: endExclusive,
        },
      },
    }),
    prisma.event.count({
      where: {
        created_at: {
          gte: start,
          lt: endExclusive,
        },
      },
    }),
    prisma.notice.count({
      where: {
        published_at: {
          gte: start,
          lt: endExclusive,
        },
      },
    }),
    prisma.emergencyNotification.count({
      where: {
        created_at: {
          gte: start,
          lt: endExclusive,
        },
      },
    }),
    prisma.feeRecord.findMany({
      where: {
        due_date: {
          gte: start,
          lt: endExclusive,
        },
      },
      select: {
        id: true,
        due_date: true,
        amount: true,
      },
    }),
    prisma.payment.findMany({
      where: {
        payment_date: {
          gte: start,
          lt: endExclusive,
        },
      },
      select: {
        payment_date: true,
        amount_paid: true,
      },
    }),
    prisma.room.findMany({
      where: { status: "ACTIVE" },
      select: { capacity: true },
    }),
    prisma.roomAllocation.count({
      where: {
        is_active: true,
        OR: [{ vacated_at: null }, { vacated_at: { gte: start } }],
      },
    }),
    prisma.student.count(),
    prisma.student.count({
      where: {
        created_at: {
          gte: start,
          lt: endExclusive,
        },
      },
    }),
  ]);

  const bucketKey = (date: Date) => {
    const y = date.getUTCFullYear();
    const m = `${date.getUTCMonth() + 1}`.padStart(2, "0");
    const d = `${date.getUTCDate()}`.padStart(2, "0");
    if (period === "yearly") {
      return `${y}-${m}`;
    }
    if (period === "monthly") {
      const weekStart = new Date(Date.UTC(y, date.getUTCMonth(), date.getUTCDate()));
      weekStart.setUTCDate(weekStart.getUTCDate() - weekStart.getUTCDay());
      const wy = weekStart.getUTCFullYear();
      const wm = `${weekStart.getUTCMonth() + 1}`.padStart(2, "0");
      const wd = `${weekStart.getUTCDate()}`.padStart(2, "0");
      return `${wy}-${wm}-${wd}`;
    }
    return `${y}-${m}-${d}`;
  };

  const attendanceBuckets = new Map<
    string,
    { present: number; leave: number; absent: number; late: number }
  >();

  for (const row of attendanceRows) {
    const key = bucketKey(row.attendance_date);
    if (!attendanceBuckets.has(key)) {
      attendanceBuckets.set(key, { present: 0, leave: 0, absent: 0, late: 0 });
    }
    const target = attendanceBuckets.get(key)!;
    if (row.attendance_status === AttendanceStatus.PRESENT) target.present += 1;
    else if (row.attendance_status === AttendanceStatus.ON_LEAVE) target.leave += 1;
    else if (row.attendance_status === AttendanceStatus.ABSENT) target.absent += 1;
    else if (row.attendance_status === AttendanceStatus.LATE_RETURN) target.late += 1;
  }

  const feeDueByBucket = new Map<string, number>();
  for (const row of feeRows) {
    const key = bucketKey(row.due_date);
    feeDueByBucket.set(key, (feeDueByBucket.get(key) || 0) + Number(row.amount));
  }

  const feePaidByBucket = new Map<string, number>();
  for (const row of paymentRows) {
    const key = bucketKey(row.payment_date);
    feePaidByBucket.set(key, (feePaidByBucket.get(key) || 0) + Number(row.amount_paid));
  }

  const bucketSet = new Set<string>([
    ...attendanceBuckets.keys(),
    ...feeDueByBucket.keys(),
    ...feePaidByBucket.keys(),
  ]);

  const labels = Array.from(bucketSet).sort((a, b) => a.localeCompare(b));

  const totalAttendance = attendanceRows.length || 1;
  const totalPresent = attendanceRows.filter(
    (row) => row.attendance_status === AttendanceStatus.PRESENT,
  ).length;
  const totalLeave = attendanceRows.filter(
    (row) => row.attendance_status === AttendanceStatus.ON_LEAVE,
  ).length;
  const totalLate = attendanceRows.filter(
    (row) => row.attendance_status === AttendanceStatus.LATE_RETURN,
  ).length;

  const totalDue = feeRows.reduce((sum, row) => sum + Number(row.amount), 0);
  const totalPaid = paymentRows.reduce((sum, row) => sum + Number(row.amount_paid), 0);

  const totalCapacity = occupancyRooms.reduce((sum, room) => sum + room.capacity, 0);
  const occupancyRate =
    totalCapacity > 0 ? Math.round((activeAllocations / totalCapacity) * 100) : 0;

  res.json({
    filters: {
      period,
      from: start.toISOString().slice(0, 10),
      to: end.toISOString().slice(0, 10),
    },
    summary: {
      attendance_percent: Math.round((totalPresent / totalAttendance) * 100),
      attendance_with_leave_percent: Math.round(
        ((totalPresent + totalLeave) / totalAttendance) * 100,
      ),
      late_returns: totalLate,
      invalid_scans: invalidScans,
      students_total: studentsTotal,
      admissions,
      occupancy_percent: occupancyRate,
      fee_due_total: Number(totalDue.toFixed(2)),
      fee_paid_total: Number(totalPaid.toFixed(2)),
      fee_pending_total: Number(Math.max(0, totalDue - totalPaid).toFixed(2)),
      leave_requests: leaveCount,
      guest_requests: guestCount,
      events_created: eventCount,
      notices_published: noticeCount,
      emergencies_created: emergencyCount,
    },
    charts: {
      attendance: labels.map((label) => {
        const bucket = attendanceBuckets.get(label) || {
          present: 0,
          leave: 0,
          absent: 0,
          late: 0,
        };
        return {
          label,
          present: bucket.present,
          leave: bucket.leave,
          absent: bucket.absent,
          late: bucket.late,
        };
      }),
      fees: labels.map((label) => ({
        label,
        due: Number((feeDueByBucket.get(label) || 0).toFixed(2)),
        paid: Number((feePaidByBucket.get(label) || 0).toFixed(2)),
      })),
      activity: [
        { label: "Leaves", value: leaveCount },
        { label: "Guests", value: guestCount },
        { label: "Events", value: eventCount },
        { label: "Notices", value: noticeCount },
        { label: "Emergency", value: emergencyCount },
      ],
    },
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

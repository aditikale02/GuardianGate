import { Response } from "express";
import {
  AlertPriority,
  HousekeepingCategory,
  MaintenanceCategory,
  Role,
  TaskStatus,
} from "@prisma/client";
import { z } from "zod";
import { prisma } from "../prisma";
import { AuthRequest } from "../middleware/auth";

const eventSchema = z.object({
  title: z.string().min(2).max(120),
  description: z.string().max(1500).optional(),
  event_date: z.string().datetime(),
  location: z.string().max(200).optional(),
});

const noticeSchema = z.object({
  title: z.string().min(2).max(120),
  content: z.string().min(4).max(1200),
  target_role: z.nativeEnum(Role).optional().nullable(),
  is_pinned: z.boolean().optional(),
  expires_at: z.string().datetime().optional(),
});

const emergencySchema = z.object({
  title: z.string().min(2).max(120),
  message: z.string().min(4).max(1200),
  priority: z.nativeEnum(AlertPriority).optional(),
});

const maintenanceCreateSchema = z.object({
  issue_type: z.string().max(80).optional(),
  room_number: z.string().max(20).optional(),
  description: z.string().min(4).max(800),
  priority: z.enum(["low", "medium", "high"]).optional(),
});

const housekeepingCreateSchema = z.object({
  category: z.string().max(80).optional(),
  description: z.string().min(4).max(800),
});

const adminPaymentUpdateSchema = z.object({
  paid_amount: z.coerce.number().min(0),
  status: z.enum(["PAID", "PARTIAL", "PENDING", "OVERDUE"]).optional(),
  remarks: z.string().max(500).optional().nullable(),
  payment_mode: z.string().max(60).optional().nullable(),
});

const taskStatusSchema = z.object({
  status: z.nativeEnum(TaskStatus),
});

const toValidationError = <TInput, TOutput>(
  res: Response,
  parseResult: z.SafeParseReturnType<TInput, TOutput>,
): parseResult is z.SafeParseError<TInput> => {
  if (parseResult.success) return false;
  res.status(400).json({ errors: parseResult.error.errors });
  return true;
};

const isAdminLike = (req: AuthRequest) =>
  req.user?.role === Role.ADMIN || req.user?.role === Role.WARDEN;

const isAdminOnly = (req: AuthRequest) => req.user?.role === Role.ADMIN;

const calculatePaymentStatus = (
  totalAmount: number,
  paidAmount: number,
  dueDate: Date,
): "PAID" | "PARTIAL" | "PENDING" | "OVERDUE" => {
  if (paidAmount >= totalAmount - 0.0001) return "PAID";
  if (dueDate.getTime() < Date.now()) return "OVERDUE";
  if (paidAmount > 0.0001) return "PARTIAL";
  return "PENDING";
};

const ensureStudent = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ message: "Not authenticated" });
    return null;
  }

  const student = await prisma.student.findUnique({
    where: { user_id: req.user.id },
    include: {
      room_allocation: {
        include: {
          room: {
            include: {
              floor: {
                include: {
                  block: true,
                },
              },
            },
          },
        },
      },
      user: {
        select: {
          full_name: true,
        },
      },
    },
  });

  if (!student) {
    res.status(403).json({ message: "Student profile not found" });
    return null;
  }

  return student;
};

const ensureStudentWithAllocation = async (req: AuthRequest, res: Response) => {
  const student = await ensureStudent(req, res);
  if (!student) return null;

  const activeAllocation = student.room_allocation;
  if (!activeAllocation || !activeAllocation.is_active) {
    res.status(400).json({ message: "No active room allocation found" });
    return null;
  }

  return {
    student,
    allocation: activeAllocation,
  };
};

const toUiTaskStatus = (status: TaskStatus): "submitted" | "in progress" | "completed" => {
  if (status === TaskStatus.RESOLVED) return "completed";
  if (status === TaskStatus.IN_PROGRESS || status === TaskStatus.AWAITING_PARTS) return "in progress";
  return "submitted";
};

const toMaintenanceCategory = (value?: string | null): MaintenanceCategory => {
  const normalized = (value || "").trim().toLowerCase();
  if (normalized.includes("electric") || normalized.includes("fan") || normalized.includes("light") || normalized.includes("wifi")) {
    return MaintenanceCategory.ELECTRICAL;
  }
  if (normalized.includes("plumb") || normalized.includes("pipe") || normalized.includes("tap") || normalized.includes("bath")) {
    return MaintenanceCategory.PLUMBING;
  }
  if (normalized.includes("bed") || normalized.includes("chair") || normalized.includes("table") || normalized.includes("wardrobe")) {
    return MaintenanceCategory.FURNITURE;
  }
  if (normalized.includes("wall") || normalized.includes("paint") || normalized.includes("door") || normalized.includes("window")) {
    return MaintenanceCategory.CIVIL;
  }
  return MaintenanceCategory.OTHER;
};

const toHousekeepingCategory = (value?: string | null): HousekeepingCategory => {
  const normalized = (value || "").trim().toLowerCase();
  if (normalized.includes("bath")) return HousekeepingCategory.BATHROOM;
  if (normalized.includes("corridor") || normalized.includes("hall")) return HousekeepingCategory.CORRIDOR;
  if (normalized.includes("common")) return HousekeepingCategory.COMMON_AREA;
  if (normalized.includes("room")) return HousekeepingCategory.ROOM_CLEANING;
  return HousekeepingCategory.OTHER;
};

const toRelativeStatus = (date: Date) => {
  const now = Date.now();
  const diff = now - date.getTime();
  const mins = Math.max(1, Math.floor(diff / 60000));
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? "s" : ""} ago`;
};

export const listEvents = async (_req: AuthRequest, res: Response) => {
  const rows = await prisma.event.findMany({
    orderBy: { event_date: "asc" },
    take: 60,
  });

  res.json({
    rows: rows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      event_date: row.event_date.toISOString(),
      location: row.location,
      upcoming: row.event_date.getTime() >= Date.now(),
    })),
  });
};

export const createEvent = async (req: AuthRequest, res: Response) => {
  if (!req.user || !isAdminLike(req)) {
    res.status(403).json({ message: "Insufficient permissions" });
    return;
  }

  const parsed = eventSchema.safeParse(req.body);
  if (toValidationError(res, parsed)) return;

  const created = await prisma.event.create({
    data: {
      title: parsed.data.title,
      description: parsed.data.description,
      event_date: new Date(parsed.data.event_date),
      location: parsed.data.location,
      created_by: req.user.id,
    },
  });

  res.status(201).json({ id: created.id });
};

export const listNotices = async (req: AuthRequest, res: Response) => {
  const role = req.user?.role;
  const now = new Date();

  const rows = await prisma.notice.findMany({
    where: {
      AND: [
        {
          OR: [
            { target_role: null },
            ...(role ? [{ target_role: role }] : []),
          ],
        },
        {
          OR: [
            { expires_at: null },
            { expires_at: { gte: now } },
          ],
        },
      ],
    },
    orderBy: [{ is_pinned: "desc" }, { published_at: "desc" }],
    take: 60,
  });

  res.json({
    rows: rows.map((row) => ({
      id: row.id,
      title: row.title,
      content: row.content,
      category: row.target_role || "GENERAL",
      is_pinned: row.is_pinned,
      published_at: row.published_at.toISOString(),
      expires_at: row.expires_at?.toISOString() ?? null,
    })),
  });
};

export const createNotice = async (req: AuthRequest, res: Response) => {
  if (!req.user || !isAdminLike(req)) {
    res.status(403).json({ message: "Insufficient permissions" });
    return;
  }

  const parsed = noticeSchema.safeParse(req.body);
  if (toValidationError(res, parsed)) return;

  const created = await prisma.notice.create({
    data: {
      title: parsed.data.title,
      content: parsed.data.content,
      target_role: parsed.data.target_role ?? null,
      is_pinned: parsed.data.is_pinned ?? false,
      expires_at: parsed.data.expires_at ? new Date(parsed.data.expires_at) : undefined,
      created_by: req.user.id,
    },
  });

  res.status(201).json({ id: created.id });
};

export const listEmergencies = async (_req: AuthRequest, res: Response) => {
  const rows = await prisma.emergencyNotification.findMany({
    orderBy: [{ resolved_at: "asc" }, { created_at: "desc" }],
    take: 40,
  });

  res.json({
    rows: rows.map((row) => ({
      id: row.id,
      title: row.title,
      message: row.message,
      priority: row.priority,
      created_at: row.created_at.toISOString(),
      active: row.resolved_at === null,
      age: toRelativeStatus(row.created_at),
    })),
  });
};

export const createEmergency = async (req: AuthRequest, res: Response) => {
  if (!req.user || !isAdminOnly(req)) {
    res.status(403).json({ message: "Insufficient permissions" });
    return;
  }

  const parsed = emergencySchema.safeParse(req.body);
  if (toValidationError(res, parsed)) return;

  const created = await prisma.emergencyNotification.create({
    data: {
      title: parsed.data.title,
      message: parsed.data.message,
      priority: parsed.data.priority,
      created_by: req.user.id,
    },
  });

  res.status(201).json({ id: created.id });
};

export const resolveEmergency = async (req: AuthRequest, res: Response) => {
  if (!req.user || !isAdminOnly(req)) {
    res.status(403).json({ message: "Insufficient permissions" });
    return;
  }

  const updated = await prisma.emergencyNotification.update({
    where: { id: req.params.id },
    data: { resolved_at: new Date() },
  });

  res.json({ id: updated.id, active: updated.resolved_at === null });
};

export const getAdminPayments = async (req: AuthRequest, res: Response) => {
  const searchRaw = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const roomRaw = typeof req.query.room === "string" ? req.query.room.trim() : "";
  const departmentRaw =
    typeof req.query.department === "string" ? req.query.department.trim() : "";
  const statusRaw = typeof req.query.status === "string" ? req.query.status.trim() : "";
  const feeTypeRaw = typeof req.query.fee_type === "string" ? req.query.fee_type.trim() : "";

  const feeRows = await prisma.feeRecord.findMany({
    include: {
      student: {
        include: {
          user: { select: { full_name: true, is_active: true } },
          room_allocation: {
            include: {
              room: {
                include: {
                  floor: {
                    include: {
                      block: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    orderBy: { due_date: "desc" },
    take: 2500,
  });

  const feeRecordIds = feeRows.map((fee) => fee.id);
  const relatedPayments = feeRecordIds.length
    ? await prisma.payment.findMany({
        where: {
          fee_record_id: {
            in: feeRecordIds,
          },
        },
        orderBy: { payment_date: "desc" },
        take: 10000,
      })
    : [];

  const paidByFeeId = new Map<string, number>();
  const latestPaymentByFeeId = new Map<string, {
    payment_date: string;
    remarks: string | null;
    recorded_by: string | null;
  }>();
  const historyByFeeId = new Map<string, Array<{
    id: string;
    amount_paid: number;
    payment_date: string;
    payment_mode: string | null;
    remarks: string | null;
    recorded_by: string | null;
  }>>();
  for (const payment of relatedPayments) {
    const prev = paidByFeeId.get(payment.fee_record_id) || 0;
    paidByFeeId.set(payment.fee_record_id, prev + Number(payment.amount_paid));

    const history = historyByFeeId.get(payment.fee_record_id) || [];
    if (history.length < 8) {
      history.push({
        id: payment.id,
        amount_paid: Number(payment.amount_paid),
        payment_date: payment.payment_date.toISOString(),
        payment_mode: payment.payment_mode,
        remarks: payment.remarks,
        recorded_by: payment.recorded_by,
      });
      historyByFeeId.set(payment.fee_record_id, history);
    }

    if (!latestPaymentByFeeId.has(payment.fee_record_id)) {
      latestPaymentByFeeId.set(payment.fee_record_id, {
        payment_date: payment.payment_date.toISOString(),
        remarks: payment.remarks,
        recorded_by: payment.recorded_by,
      });
    }
  }

  const rows = feeRows
    .map((fee) => {
      const feeAmount = Number(fee.amount);
      const paidAmount = Math.min(feeAmount, paidByFeeId.get(fee.id) || 0);
      const pending = Math.max(0, feeAmount - paidAmount);
      const latestPayment = latestPaymentByFeeId.get(fee.id);

      const status = calculatePaymentStatus(feeAmount, paidAmount, fee.due_date);

      const room = fee.student.room_allocation?.room;
      const floor = room?.floor;
      const block = floor?.block;

      return {
        id: fee.id,
        student_id: fee.student.hostel_id,
        student: fee.student.user.full_name,
        enrollment_no: fee.student.enrollment_no,
        hostel: block?.name ?? "N/A",
        floor: floor ? `Floor ${floor.floor_number}` : "N/A",
        room: room?.room_number ?? "N/A",
        department: fee.student.department,
        active: fee.student.user.is_active,
        fee_type: fee.fee_type,
        amount: feeAmount,
        paid_amount: Number(paidAmount.toFixed(2)),
        pending_amount: Number(pending.toFixed(2)),
        payment_date: latestPayment?.payment_date ?? null,
        due_date: fee.due_date.toISOString(),
        remarks: latestPayment?.remarks ?? null,
        updated_by: latestPayment?.recorded_by ?? null,
        last_updated: latestPayment?.payment_date ?? fee.created_at.toISOString(),
        status,
        history: historyByFeeId.get(fee.id) || [],
      };
    })
    .filter((row) => {
      const q = searchRaw.toLowerCase();
      if (!q) return true;
      return (
        row.student.toLowerCase().includes(q) ||
        row.student_id.toLowerCase().includes(q) ||
        row.enrollment_no.toLowerCase().includes(q) ||
        row.hostel.toLowerCase().includes(q) ||
        row.floor.toLowerCase().includes(q) ||
        row.room.toLowerCase().includes(q) ||
        row.department.toLowerCase().includes(q) ||
        row.fee_type.toLowerCase().includes(q)
      );
    })
    .filter((row) => {
      if (!roomRaw || roomRaw === "ALL") return true;
      return row.room.toLowerCase().includes(roomRaw.toLowerCase());
    })
    .filter((row) => {
      if (!departmentRaw || departmentRaw === "ALL") return true;
      return row.department === departmentRaw;
    })
    .filter((row) => {
      if (!statusRaw || statusRaw === "ALL") return true;
      return row.status === statusRaw;
    })
    .filter((row) => {
      if (!feeTypeRaw || feeTypeRaw === "ALL") return true;
      return row.fee_type.toLowerCase() === feeTypeRaw.toLowerCase();
    });

  const totalCollected = rows.reduce((acc, row) => acc + row.paid_amount, 0);
  const totalPending = rows.reduce((acc, row) => acc + row.pending_amount, 0);
  const totalOverdue = rows
    .filter((row) => row.status === "OVERDUE")
    .reduce((acc, row) => acc + row.pending_amount, 0);

  const studentDueMap = new Map<string, { pending: number; overdue: number }>();
  for (const row of rows) {
    const current = studentDueMap.get(row.student_id) || { pending: 0, overdue: 0 };
    current.pending += row.pending_amount;
    if (row.status === "OVERDUE") {
      current.overdue += row.pending_amount;
    }
    studentDueMap.set(row.student_id, current);
  }

  const totalStudentsPaid = Array.from(studentDueMap.values()).filter((entry) => entry.pending <= 0.0001).length;
  const totalStudentsPending = Array.from(studentDueMap.values()).filter((entry) => entry.pending > 0.0001).length;
  const totalStudentsOverdue = Array.from(studentDueMap.values()).filter((entry) => entry.overdue > 0.0001).length;

  res.json({
    filters: {
      search: searchRaw,
      room: roomRaw || "ALL",
      department: departmentRaw || "ALL",
      status: statusRaw || "ALL",
      fee_type: feeTypeRaw || "ALL",
    },
    summary: {
      total_collected: Number(totalCollected.toFixed(2)),
      total_pending: Number(totalPending.toFixed(2)),
      total_overdue: Number(totalOverdue.toFixed(2)),
      total_students_paid: totalStudentsPaid,
      total_students_pending: totalStudentsPending,
      total_students_overdue: totalStudentsOverdue,
    },
    rows,
  });
};

export const updateAdminPayment = async (req: AuthRequest, res: Response) => {
  if (!req.user || !isAdminOnly(req)) {
    res.status(403).json({ message: "Insufficient permissions" });
    return;
  }

  const parsed = adminPaymentUpdateSchema.safeParse(req.body);
  if (toValidationError(res, parsed)) return;

  const feeRecordId = req.params.id;
  if (!feeRecordId) {
    res.status(400).json({ message: "Fee record id is required" });
    return;
  }

  const feeRecord = await prisma.feeRecord.findUnique({
    where: { id: feeRecordId },
    include: {
      student: {
        include: {
          user: { select: { full_name: true } },
          room_allocation: {
            include: {
              room: {
                include: {
                  floor: {
                    include: {
                      block: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!feeRecord) {
    res.status(404).json({ message: "Fee record not found" });
    return;
  }

  const totalAmount = Number(feeRecord.amount);
  const desiredPaid = Number(parsed.data.paid_amount.toFixed(2));
  if (desiredPaid > totalAmount + 0.0001) {
    res.status(400).json({ message: "Paid amount cannot exceed total fee" });
    return;
  }

  const aggregate = await prisma.payment.aggregate({
    where: { fee_record_id: feeRecord.id },
    _sum: { amount_paid: true },
  });
  const currentPaid = Number(aggregate._sum.amount_paid || 0);
  const delta = Number((desiredPaid - currentPaid).toFixed(2));

  const calculatedStatus = calculatePaymentStatus(totalAmount, desiredPaid, feeRecord.due_date);
  if (parsed.data.status && parsed.data.status !== calculatedStatus) {
    res.status(400).json({
      message: `Status must be ${calculatedStatus} for paid amount ${desiredPaid.toFixed(2)} and due date ${feeRecord.due_date.toISOString().slice(0, 10)}`,
    });
    return;
  }

  await prisma.$transaction(async (tx) => {
    if (Math.abs(delta) > 0.0001) {
      await tx.payment.create({
        data: {
          student_id: feeRecord.student_id,
          fee_record_id: feeRecord.id,
          amount_paid: delta,
          payment_mode: parsed.data.payment_mode || "MANUAL_ADMIN_UPDATE",
          recorded_by: req.user!.id,
          remarks: parsed.data.remarks || (delta >= 0 ? "Admin manual payment update" : "Admin manual payment correction"),
        },
      });
    }

    await tx.feeRecord.update({
      where: { id: feeRecord.id },
      data: {
        is_paid: calculatedStatus === "PAID",
      },
    });

    await tx.auditLog.create({
      data: {
        user_id: req.user!.id,
        action_type: "ADMIN_PAYMENT_UPDATE",
        target_type: "FeeRecord",
        target_id: feeRecord.id,
        metadata: {
          student_id: feeRecord.student.hostel_id,
          previous_paid_amount: Number(currentPaid.toFixed(2)),
          updated_paid_amount: desiredPaid,
          delta_amount: delta,
          status: calculatedStatus,
          remarks: parsed.data.remarks || null,
        },
      },
    });
  });

  const finalPending = Number((totalAmount - desiredPaid).toFixed(2));
  const room = feeRecord.student.room_allocation?.room;
  const floor = room?.floor;
  const block = floor?.block;

  res.json({
    message: "Payment updated successfully",
    row: {
      id: feeRecord.id,
      student_id: feeRecord.student.hostel_id,
      student: feeRecord.student.user.full_name,
      enrollment_no: feeRecord.student.enrollment_no,
      hostel: block?.name ?? "N/A",
      floor: floor ? `Floor ${floor.floor_number}` : "N/A",
      room: room?.room_number ?? "N/A",
      fee_type: feeRecord.fee_type,
      amount: totalAmount,
      paid_amount: desiredPaid,
      pending_amount: finalPending,
      due_date: feeRecord.due_date.toISOString(),
      status: calculatedStatus,
      updated_by: req.user.id,
      updated_at: new Date().toISOString(),
    },
  });
};

export const getMyPayments = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }

  const student = await prisma.student.findUnique({ where: { user_id: req.user.id } });
  if (!student) {
    res.status(403).json({ message: "Student profile not found" });
    return;
  }

  const [feeRows, payments] = await prisma.$transaction([
    prisma.feeRecord.findMany({
      where: { student_id: student.id },
      orderBy: { due_date: "desc" },
      take: 80,
    }),
    prisma.payment.findMany({
      where: { student_id: student.id },
      orderBy: { payment_date: "desc" },
      take: 80,
    }),
  ]);

  const paidByFeeId = new Map<string, number>();
  for (const payment of payments) {
    const prev = paidByFeeId.get(payment.fee_record_id) || 0;
    paidByFeeId.set(payment.fee_record_id, prev + Number(payment.amount_paid));
  }

  const rows = feeRows.map((fee) => {
    const feeAmount = Number(fee.amount);
    const paidAmount = Math.min(feeAmount, paidByFeeId.get(fee.id) || 0);
    const pending = Math.max(0, feeAmount - paidAmount);

    let status: "PAID" | "PENDING" | "OVERDUE" = "PENDING";
    if (pending <= 0.0001) status = "PAID";
    else if (new Date(fee.due_date).getTime() < Date.now()) status = "OVERDUE";

    return {
      id: fee.id,
      fee_type: fee.fee_type,
      amount: feeAmount,
      due_date: fee.due_date.toISOString(),
      status,
      pending,
    };
  });

  const total = rows.reduce((acc, row) => acc + row.amount, 0);
  const paid = rows.reduce((acc, row) => acc + (row.amount - row.pending), 0);
  const pending = rows.reduce((acc, row) => acc + row.pending, 0);
  const nearestDue = rows
    .filter((row) => row.pending > 0)
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())[0];

  res.json({
    summary: {
      total: Number(total.toFixed(2)),
      paid: Number(paid.toFixed(2)),
      pending: Number(pending.toFixed(2)),
      due_date: nearestDue?.due_date ?? null,
    },
    rows,
  });
};

export const listMaintenanceRequests = async (_req: AuthRequest, res: Response) => {
  const rows = await prisma.maintenanceRequest.findMany({
    include: {
      student: {
        include: {
          user: { select: { full_name: true } },
        },
      },
      room: {
        select: { room_number: true },
      },
    },
    orderBy: { created_at: "desc" },
    take: 200,
  });

  res.json({
    rows: rows.map((row) => ({
      id: row.id,
      room: row.room.room_number,
      student: row.student.user.full_name,
      type: row.category,
      description: row.description,
      priority: (row.urgency || "NORMAL").toLowerCase(),
      status: toUiTaskStatus(row.status),
      raw_status: row.status,
      date: row.created_at.toISOString(),
    })),
  });
};

export const listMyMaintenanceRequests = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }

  const student = await prisma.student.findUnique({
    where: { user_id: req.user.id },
    select: { id: true },
  });

  if (!student) {
    res.json({
      rows: [],
      notice: "Student profile not found.",
    });
    return;
  }

  const rows = await prisma.maintenanceRequest.findMany({
    where: { student_id: student.id },
    include: {
      room: {
        select: { room_number: true },
      },
    },
    orderBy: { created_at: "desc" },
    take: 100,
  });

  res.json({
    rows: rows.map((row) => ({
      id: row.id,
      type: row.category,
      room: row.room?.room_number || "N/A",
      priority: (row.urgency || "NORMAL").toLowerCase(),
      status: toUiTaskStatus(row.status),
      raw_status: row.status,
      date: row.created_at.toISOString(),
      description: row.description,
    })),
  });
};

export const createMaintenanceRequest = async (req: AuthRequest, res: Response) => {
  const ctx = await ensureStudentWithAllocation(req, res);
  if (!ctx) return;

  const parsed = maintenanceCreateSchema.safeParse(req.body);
  if (toValidationError(res, parsed)) return;

  const created = await prisma.maintenanceRequest.create({
    data: {
      student_id: ctx.student.id,
      room_id: ctx.allocation.room_id,
      category: toMaintenanceCategory(parsed.data.issue_type),
      description: parsed.data.description,
      urgency: (parsed.data.priority || "medium").toUpperCase(),
      status: TaskStatus.PENDING,
    },
  });

  res.status(201).json({ id: created.id, status: created.status });
};

export const updateMaintenanceStatus = async (req: AuthRequest, res: Response) => {
  if (!req.user || !isAdminLike(req)) {
    res.status(403).json({ message: "Insufficient permissions" });
    return;
  }

  const parsed = taskStatusSchema.safeParse(req.body);
  if (toValidationError(res, parsed)) return;

  const updated = await prisma.maintenanceRequest.update({
    where: { id: req.params.id },
    data: {
      status: parsed.data.status,
      resolved_at: parsed.data.status === TaskStatus.RESOLVED ? new Date() : null,
    },
  });

  res.json({ id: updated.id, status: updated.status });
};

export const listHousekeepingRequests = async (_req: AuthRequest, res: Response) => {
  const rows = await prisma.housekeepingRequest.findMany({
    include: {
      student: {
        include: {
          user: { select: { full_name: true } },
        },
      },
      room: {
        select: { room_number: true },
      },
    },
    orderBy: { created_at: "desc" },
    take: 200,
  });

  res.json({
    rows: rows.map((row) => ({
      id: row.id,
      room: row.room.room_number,
      student: row.student.user.full_name,
      issue: row.description,
      category: row.category,
      status: toUiTaskStatus(row.status),
      raw_status: row.status,
      date: row.created_at.toISOString(),
    })),
  });
};

export const listMyHousekeepingRequests = async (req: AuthRequest, res: Response) => {
  const student = await ensureStudent(req, res);
  if (!student) return;

  const rows = await prisma.housekeepingRequest.findMany({
    where: { student_id: student.id },
    include: {
      room: {
        select: { room_number: true },
      },
    },
    orderBy: { created_at: "desc" },
    take: 100,
  });

  res.json({
    rows: rows.map((row) => ({
      id: row.id,
      issue: row.description,
      room: row.room.room_number,
      status: toUiTaskStatus(row.status),
      raw_status: row.status,
      date: row.created_at.toISOString(),
      category: row.category,
    })),
  });
};

export const createHousekeepingRequest = async (req: AuthRequest, res: Response) => {
  const ctx = await ensureStudentWithAllocation(req, res);
  if (!ctx) return;

  const parsed = housekeepingCreateSchema.safeParse(req.body);
  if (toValidationError(res, parsed)) return;

  const created = await prisma.housekeepingRequest.create({
    data: {
      student_id: ctx.student.id,
      room_id: ctx.allocation.room_id,
      category: toHousekeepingCategory(parsed.data.category),
      description: parsed.data.description,
      status: TaskStatus.PENDING,
    },
  });

  res.status(201).json({ id: created.id, status: created.status });
};

export const updateHousekeepingStatus = async (req: AuthRequest, res: Response) => {
  if (!req.user || !isAdminLike(req)) {
    res.status(403).json({ message: "Insufficient permissions" });
    return;
  }

  const parsed = taskStatusSchema.safeParse(req.body);
  if (toValidationError(res, parsed)) return;

  const updated = await prisma.housekeepingRequest.update({
    where: { id: req.params.id },
    data: {
      status: parsed.data.status,
      resolved_at: parsed.data.status === TaskStatus.RESOLVED ? new Date() : null,
    },
  });

  res.json({ id: updated.id, status: updated.status });
};

export const getMyRoomDetails = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }

  const student = await prisma.student.findUnique({
    where: { user_id: req.user.id },
    include: {
      room_allocation: {
        include: {
          room: {
            include: {
              floor: {
                include: {
                  block: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!student) {
    res.json({
      room: null,
      roommates: [],
      facilities: [],
      message: "Student profile not found.",
    });
    return;
  }

  const allocation = student.room_allocation;
  if (!allocation || !allocation.is_active || !allocation.room) {
    res.json({
      room: null,
      roommates: [],
      facilities: [],
      message: "No active room allocation found.",
    });
    return;
  }

  const roommates = await prisma.roomAllocation.findMany({
    where: {
      room_id: allocation.room_id,
      is_active: true,
      student_id: { not: student.id },
    },
    include: {
      student: {
        include: {
          user: {
            select: { full_name: true, phone: true },
          },
        },
      },
    },
    take: 5,
  });

  const room = allocation.room;
  const floor = room.floor;
  const block = floor.block;

  res.json({
    room: {
      number: room.room_number,
      block: block.name,
      floor: `${floor.floor_number}${floor.floor_number === 1 ? "st" : floor.floor_number === 2 ? "nd" : floor.floor_number === 3 ? "rd" : "th"} Floor`,
      type: room.room_type,
      bed_number: allocation.bed_number,
      capacity: room.capacity,
      occupancy: room.current_occupancy,
    },
    roommates: roommates.map((row) => ({
      id: row.student.id,
      name: row.student.user.full_name,
      course: `${row.student.department} - Year ${row.student.year_of_study}`,
      phone: row.student.user.phone || '',
    })),
    facilities: [
      "Attached Bathroom",
      "Ceiling Fan",
      "Wardrobe",
      "Study Table",
      "Wi-Fi",
    ],
  });
};

export const getCampusContacts = async (_req: AuthRequest, res: Response) => {
  const wardens = await prisma.user.findMany({
    where: {
      role: { in: [Role.WARDEN, Role.ADMIN] },
      is_active: true,
    },
    select: {
      id: true,
      full_name: true,
      role: true,
      email: true,
      phone: true,
    },
    orderBy: { created_at: "asc" },
    take: 12,
  });

  res.json({
    office_hours: "9:00 AM - 6:00 PM (Mon-Sat)",
    rows: [
      ...wardens.map((warden, idx) => ({
        id: warden.id,
        name: warden.full_name,
        role: warden.role === Role.ADMIN ? "Chief Warden" : `Floor Warden (${idx + 1})`,
        phone: warden.phone || "N/A",
        email: warden.email || "",
      })),
      {
        id: "office",
        name: "Hostel Office",
        role: "Admin Office",
        phone: "+91 80123 45678",
        email: "office@hostel.edu",
      },
      {
        id: "security",
        name: "Security Gate",
        role: "Main Gate",
        phone: "+91 87654 32109",
        email: "",
      },
      {
        id: "emergency",
        name: "Emergency",
        role: "Medical / Fire / Police",
        phone: "112",
        email: "",
      },
    ],
  });
};

export const getMyRequestHistory = async (req: AuthRequest, res: Response) => {
  const student = await ensureStudent(req, res);
  if (!student) return;

  type MissingReportHistoryRow = {
    id: string;
    title: string;
    status: string;
    created_at: Date;
  };

  const [
    leaveRows,
    parcelRows,
    medicalRows,
    maintenanceRows,
    housekeepingRows,
    guestRows,
    suggestionRows,
  ] =
    await prisma.$transaction([
      prisma.nightLeaveRequest.findMany({
        where: { student_id: student.id },
        orderBy: { created_at: "desc" },
        take: 30,
      }),
      prisma.parcelRecord.findMany({
        where: { student_id: student.id },
        orderBy: { received_at: "desc" },
        take: 30,
      }),
      prisma.medicalRequest.findMany({
        where: { student_id: student.id },
        orderBy: { created_at: "desc" },
        take: 30,
      }),
      prisma.maintenanceRequest.findMany({
        where: { student_id: student.id },
        orderBy: { created_at: "desc" },
        take: 30,
      }),
      prisma.housekeepingRequest.findMany({
        where: { student_id: student.id },
        orderBy: { created_at: "desc" },
        take: 30,
      }),
      prisma.guestRequest.findMany({
        where: { student_id: student.id },
        orderBy: { created_at: "desc" },
        take: 30,
      }),
      prisma.suggestion.findMany({
        where: { student_id: student.id },
        orderBy: { created_at: "desc" },
        take: 30,
      }),
    ]);

  const missingReportRows = await prisma.$queryRawUnsafe<MissingReportHistoryRow[]>(
    `
      SELECT *
      FROM "MissingReport"
      WHERE "student_id" = $1
      ORDER BY "created_at" DESC
      LIMIT 30
    `,
    student.id,
  );

  const rows = [
    ...leaveRows.map((row) => ({
      id: row.id,
      type: "Leave",
      title: `Night leave - ${row.reason}`,
      status: row.status,
      date: row.created_at.toISOString(),
    })),
    ...parcelRows.map((row) => ({
      id: row.id,
      type: "Parcel",
      title: row.description,
      status: row.status,
      date: row.received_at.toISOString(),
    })),
    ...medicalRows.map((row) => ({
      id: row.id,
      type: "Medical",
      title: row.symptoms,
      status: row.status,
      date: row.created_at.toISOString(),
    })),
    ...maintenanceRows.map((row) => ({
      id: row.id,
      type: "Maintenance",
      title: row.description,
      status: toUiTaskStatus(row.status).replace(" ", "_"),
      date: row.created_at.toISOString(),
    })),
    ...housekeepingRows.map((row) => ({
      id: row.id,
      type: "Housekeeping",
      title: row.description,
      status: toUiTaskStatus(row.status).replace(" ", "_"),
      date: row.created_at.toISOString(),
    })),
    ...guestRows.map((row) => ({
      id: row.id,
      type: "Guest",
      title: `${row.guest_name} - ${row.relationship}`,
      status: row.status,
      date: row.created_at.toISOString(),
    })),
    ...suggestionRows.map((row) => ({
      id: row.id,
      type: "Suggestion",
      title: row.title,
      status: "PENDING",
      date: row.created_at.toISOString(),
    })),
    ...missingReportRows.map((row) => ({
      id: row.id,
      type: "Missing Report",
      title: row.title,
      status: row.status,
      date: row.created_at.toISOString(),
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  res.json({ rows: rows.slice(0, 120) });
};

import bcrypt from "bcryptjs";
import { Department, Role, ShiftTiming } from "@prisma/client";
import "../src/config/env.config";
import { prisma } from "../src/prisma";

const DEFAULT_PASSWORD = "Pass@123";

type WardenSeed = {
  fullName: string;
  email: string;
  phone: string;
  assignedHostel: string;
  assignedBlock: string;
  assignedFloor: string;
  shift: ShiftTiming;
};

type StudentSeed = {
  index: number;
  fullName: string;
  email: string;
  phone: string;
  enrollmentNo: string;
  hostelId: string;
  department: Department;
  courseBranch: string;
  yearOfStudy: number;
  guardianName: string;
  guardianRelation: string;
  guardianPhone: string;
};

const wardens: WardenSeed[] = [
  {
    fullName: "Aditi Sharma",
    email: "warden1.bulk@guardian.com",
    phone: "9000000001",
    assignedHostel: "H1",
    assignedBlock: "A",
    assignedFloor: "1",
    shift: ShiftTiming.DAY,
  },
  {
    fullName: "Rohit Verma",
    email: "warden2.bulk@guardian.com",
    phone: "9000000002",
    assignedHostel: "H1",
    assignedBlock: "A",
    assignedFloor: "2",
    shift: ShiftTiming.NIGHT,
  },
  {
    fullName: "Meera Kulkarni",
    email: "warden3.bulk@guardian.com",
    phone: "9000000003",
    assignedHostel: "H1",
    assignedBlock: "A",
    assignedFloor: "3",
    shift: ShiftTiming.BOTH,
  },
];

const students: StudentSeed[] = Array.from({ length: 15 }, (_, i) => {
  const n = i + 1;
  const padded = String(n).padStart(3, "0");
  return {
    index: n,
    fullName: `Student ${padded}`,
    email: `student${padded}.bulk@guardian.com`,
    phone: `9100000${String(n).padStart(3, "0")}`,
    enrollmentNo: `ENR-BULK-${padded}`,
    hostelId: `HST-BULK-${padded}`,
    department:
      n % 3 === 0
        ? Department.AIML
        : n % 3 === 1
          ? Department.COMPUTER_ENGINEERING
          : Department.IT,
    courseBranch: n % 2 === 0 ? "B.Tech" : "B.E.",
    yearOfStudy: ((n - 1) % 4) + 1,
    guardianName: `Guardian ${padded}`,
    guardianRelation: n % 2 === 0 ? "Father" : "Mother",
    guardianPhone: `9200000${String(n).padStart(3, "0")}`,
  };
});

const toUsername = (seed: string) =>
  seed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 24) || "user";

const ensureUniqueUsername = async (seed: string, currentUserId?: string) => {
  const normalized = toUsername(seed);
  let candidate = normalized;

  for (let i = 1; i <= 1000; i += 1) {
    const existing = await prisma.user.findUnique({
      where: { username: candidate },
      select: { id: true },
    });

    if (!existing || existing.id === currentUserId) {
      return candidate;
    }

    candidate = `${normalized}${i}`;
  }

  return `${normalized}${Date.now()}`;
};

const ensureUniqueWardenId = async (preferred: string, userId?: string) => {
  let candidate = preferred;

  for (let i = 1; i <= 1000; i += 1) {
    const existing = await prisma.wardenProfile.findUnique({
      where: { warden_id: candidate },
      select: { user_id: true },
    });

    if (!existing || existing.user_id === userId) {
      return candidate;
    }

    candidate = `${preferred}-${i}`;
  }

  return `${preferred}-${Date.now()}`;
};

const ensureBlockFloorRoom = async (
  roomNumber: string,
): Promise<{ roomId: string; bedNumber: number }> => {
  const block = await prisma.hostelBlock.upsert({
    where: { name: "H1-A" },
    update: {},
    create: {
      name: "H1-A",
      description: "Bulk seed auto block",
    },
  });

  const floor = await prisma.floor.upsert({
    where: {
      block_id_floor_number: {
        block_id: block.id,
        floor_number: 1,
      },
    },
    update: {},
    create: {
      block_id: block.id,
      floor_number: 1,
      name: "Floor 1",
    },
  });

  const room = await prisma.room.upsert({
    where: {
      floor_id_room_number: {
        floor_id: floor.id,
        room_number: roomNumber,
      },
    },
    update: {
      capacity: 3,
    },
    create: {
      floor_id: floor.id,
      room_number: roomNumber,
      room_type: "TRIPLE",
      capacity: 3,
      current_occupancy: 0,
    },
  });

  const activeAllocations = await prisma.roomAllocation.count({
    where: {
      room_id: room.id,
      is_active: true,
    },
  });

  const bedNumber = Math.max(1, Math.min(3, activeAllocations + 1));

  return {
    roomId: room.id,
    bedNumber,
  };
};

const syncRoomOccupancy = async () => {
  const rooms = await prisma.room.findMany({ select: { id: true } });

  await Promise.all(
    rooms.map(async (room) => {
      const occupancy = await prisma.roomAllocation.count({
        where: {
          room_id: room.id,
          is_active: true,
        },
      });

      await prisma.room.update({
        where: { id: room.id },
        data: { current_occupancy: occupancy },
      });
    }),
  );
};

const seedWardens = async (passwordHash: string, adminId?: string) => {
  const createdWardenIds: string[] = [];

  for (let i = 0; i < wardens.length; i += 1) {
    const warden = wardens[i];

    const existing = await prisma.user.findUnique({
      where: { email: warden.email },
      include: { warden_profile: true },
    });

    const username = await ensureUniqueUsername(
      existing?.username || warden.fullName,
      existing?.id,
    );

    if (!existing) {
      const wardenId = await ensureUniqueWardenId(`WRD-BULK-${String(i + 1).padStart(2, "0")}`);

      const created = await prisma.user.create({
        data: {
          full_name: warden.fullName,
          email: warden.email,
          username,
          phone: warden.phone,
          role: Role.WARDEN,
          password_hash: passwordHash,
          is_active: true,
          first_login: false,
          created_by_admin_id: adminId,
          warden_profile: {
            create: {
              warden_id: wardenId,
              assigned_hostel: warden.assignedHostel,
              assigned_block: warden.assignedBlock,
              assigned_floor: warden.assignedFloor,
              shift_timing: warden.shift,
              can_approve_leave: true,
              can_manage_guest_entries: true,
              can_manage_parcel_requests: true,
              can_access_student_records: true,
              can_send_notices: true,
              can_handle_medical_requests: true,
            },
          },
        },
        select: { id: true },
      });

      createdWardenIds.push(created.id);
      continue;
    }

    await prisma.user.update({
      where: { id: existing.id },
      data: {
        full_name: warden.fullName,
        phone: warden.phone,
        username,
        role: Role.WARDEN,
        password_hash: passwordHash,
        is_active: true,
        first_login: false,
      },
    });

    if (existing.warden_profile) {
      const wardenId = await ensureUniqueWardenId(existing.warden_profile.warden_id, existing.id);
      await prisma.wardenProfile.update({
        where: { user_id: existing.id },
        data: {
          warden_id: wardenId,
          assigned_hostel: warden.assignedHostel,
          assigned_block: warden.assignedBlock,
          assigned_floor: warden.assignedFloor,
          shift_timing: warden.shift,
          can_approve_leave: true,
          can_manage_guest_entries: true,
          can_manage_parcel_requests: true,
          can_access_student_records: true,
          can_send_notices: true,
          can_handle_medical_requests: true,
        },
      });
    } else {
      const wardenId = await ensureUniqueWardenId(`WRD-BULK-${String(i + 1).padStart(2, "0")}`, existing.id);
      await prisma.wardenProfile.create({
        data: {
          user_id: existing.id,
          warden_id: wardenId,
          assigned_hostel: warden.assignedHostel,
          assigned_block: warden.assignedBlock,
          assigned_floor: warden.assignedFloor,
          shift_timing: warden.shift,
          can_approve_leave: true,
          can_manage_guest_entries: true,
          can_manage_parcel_requests: true,
          can_access_student_records: true,
          can_send_notices: true,
          can_handle_medical_requests: true,
        },
      });
    }

    createdWardenIds.push(existing.id);
  }

  return createdWardenIds;
};

const seedStudents = async (
  passwordHash: string,
  wardenIds: string[],
  adminId?: string,
) => {
  for (let i = 0; i < students.length; i += 1) {
    const student = students[i];
    const assignedWardenId = wardenIds[i % wardenIds.length];
    const roomBucket = Math.floor(i / 3) + 101;
    const roomNumber = String(roomBucket);

    const room = await ensureBlockFloorRoom(roomNumber);
    const gateId = `GP-BULK-${String(student.index).padStart(3, "0")}`;
    const qrId = `QR-BULK-${String(student.index).padStart(3, "0")}`;

    const existing = await prisma.user.findUnique({
      where: { email: student.email },
      include: { student: true },
    });

    const username = await ensureUniqueUsername(
      existing?.username || student.enrollmentNo,
      existing?.id,
    );

    if (!existing) {
      const created = await prisma.user.create({
        data: {
          full_name: student.fullName,
          email: student.email,
          username,
          phone: student.phone,
          role: Role.STUDENT,
          password_hash: passwordHash,
          is_active: true,
          first_login: false,
          created_by_admin_id: adminId,
          student: {
            create: {
              hostel_id: student.hostelId,
              enrollment_no: student.enrollmentNo,
              department: student.department,
              course_branch: student.courseBranch,
              year_of_study: student.yearOfStudy,
              assigned_warden_id: assignedWardenId,
              mess_plan_enabled: true,
              guardian_name: student.guardianName,
              guardian_relation: student.guardianRelation,
              guardian_phone: student.guardianPhone,
              emergency_contact_phone: student.guardianPhone,
              permanent_address: "Bulk Seed Address",
              gate_pass_id: gateId,
              qr_gate_id: qrId,
              leave_balance: 15,
              medical_notes: "N/A",
            },
          },
        },
        include: { student: true },
      });

      if (created.student) {
        await prisma.roomAllocation.upsert({
          where: { student_id: created.student.id },
          update: {
            room_id: room.roomId,
            bed_number: room.bedNumber,
            is_active: true,
            vacated_at: null,
            allocated_by: adminId,
          },
          create: {
            student_id: created.student.id,
            room_id: room.roomId,
            bed_number: room.bedNumber,
            is_active: true,
            allocated_by: adminId,
          },
        });
      }

      continue;
    }

    await prisma.user.update({
      where: { id: existing.id },
      data: {
        full_name: student.fullName,
        username,
        phone: student.phone,
        role: Role.STUDENT,
        password_hash: passwordHash,
        is_active: true,
        first_login: false,
      },
    });

    if (existing.student) {
      await prisma.student.update({
        where: { user_id: existing.id },
        data: {
          hostel_id: student.hostelId,
          enrollment_no: student.enrollmentNo,
          department: student.department,
          course_branch: student.courseBranch,
          year_of_study: student.yearOfStudy,
          assigned_warden_id: assignedWardenId,
          mess_plan_enabled: true,
          guardian_name: student.guardianName,
          guardian_relation: student.guardianRelation,
          guardian_phone: student.guardianPhone,
          emergency_contact_phone: student.guardianPhone,
          permanent_address: "Bulk Seed Address",
          gate_pass_id: gateId,
          qr_gate_id: qrId,
          leave_balance: 15,
          medical_notes: "N/A",
        },
      });

      await prisma.roomAllocation.upsert({
        where: { student_id: existing.student.id },
        update: {
          room_id: room.roomId,
          bed_number: room.bedNumber,
          is_active: true,
          vacated_at: null,
          allocated_by: adminId,
        },
        create: {
          student_id: existing.student.id,
          room_id: room.roomId,
          bed_number: room.bedNumber,
          is_active: true,
          allocated_by: adminId,
        },
      });
    }
  }
};

const run = async () => {
  try {
    await prisma.$connect();

    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
    const admin = await prisma.user.findFirst({
      where: { role: Role.ADMIN },
      select: { id: true },
    });

    const wardenIds = await seedWardens(passwordHash, admin?.id);
    await seedStudents(passwordHash, wardenIds, admin?.id);
    await syncRoomOccupancy();

    console.log("\nBulk seed completed successfully.");
    console.log(`Wardens inserted/updated: ${wardens.length}`);
    console.log(`Students inserted/updated: ${students.length}`);
    console.log(`Default password for these users: ${DEFAULT_PASSWORD}\n`);
  } catch (error) {
    console.error("Bulk seed failed:", error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
};

void run();

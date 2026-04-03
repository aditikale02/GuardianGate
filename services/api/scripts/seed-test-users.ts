import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import "../src/config/env.config";
import { prisma } from "../src/prisma";

const TEST_CREDENTIALS = {
  adminPassword: "Admin@123",
  wardenEmail: "warden.test@guardian.com",
  wardenPassword: "Warden@123",
  studentEmail: "student.test@guardian.com",
  studentPassword: "Student@123",
} as const;

const DEFAULT_STUDENT_DEPARTMENT = "COMPUTER_ENGINEERING";

const ensureDefaultRoomAllocation = async (studentId: string, allocatedBy?: string) => {
  const block = await prisma.hostelBlock.upsert({
    where: { name: "H1-A" },
    update: {},
    create: {
      name: "H1-A",
      description: "Default test-user block",
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
        room_number: "101",
      },
    },
    update: {
      capacity: 3,
      status: "ACTIVE",
    },
    create: {
      floor_id: floor.id,
      room_number: "101",
      room_type: "TRIPLE",
      capacity: 3,
      current_occupancy: 0,
      status: "ACTIVE",
    },
  });

  await prisma.roomAllocation.upsert({
    where: { student_id: studentId },
    update: {
      room_id: room.id,
      bed_number: 1,
      is_active: true,
      vacated_at: null,
      allocated_by: allocatedBy,
    },
    create: {
      student_id: studentId,
      room_id: room.id,
      bed_number: 1,
      is_active: true,
      allocated_by: allocatedBy,
    },
  });

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
};

const baseUsername = (value: string) => {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 24);

  return normalized.length > 0 ? normalized : "user";
};

const ensureUniqueUsername = async (seed: string, excludeUserId?: string) => {
  const normalized = baseUsername(seed);
  let candidate = normalized;

  for (let i = 1; i <= 1000; i += 1) {
    const existing = await prisma.user.findUnique({
      where: { username: candidate },
      select: { id: true },
    });

    if (!existing || existing.id === excludeUserId) {
      return candidate;
    }

    candidate = `${normalized}${i}`;
  }

  return `${normalized}${Date.now()}`;
};

const nextUniqueStudentField = async (
  field: "hostel_id" | "enrollment_no",
  baseValue: string,
) => {
  let candidate = baseValue;

  for (let i = 1; i <= 1000; i += 1) {
    const existing = await prisma.student.findUnique({
      where: field === "hostel_id" ? { hostel_id: candidate } : { enrollment_no: candidate },
      select: { id: true },
    });

    if (!existing) {
      return candidate;
    }

    candidate = `${baseValue}-${i}`;
  }

  return `${baseValue}-${Date.now()}`;
};

const seedAdmin = async () => {
  const hash = await bcrypt.hash(TEST_CREDENTIALS.adminPassword, 10);
  const existingAdmin = await prisma.user.findFirst({
    where: { role: Role.ADMIN },
    orderBy: { created_at: "asc" },
    select: { id: true, email: true, username: true, full_name: true },
  });

  if (existingAdmin) {
    await prisma.user.update({
      where: { id: existingAdmin.id },
      data: {
        password_hash: hash,
        first_login: false,
        is_active: true,
      },
    });

    return {
      email: existingAdmin.email,
      password: TEST_CREDENTIALS.adminPassword,
      created: false,
    };
  }

  const username = await ensureUniqueUsername("admin");
  const createdAdmin = await prisma.user.create({
    data: {
      full_name: "Test Admin",
      username,
      email: "admin.test@guardian.com",
      password_hash: hash,
      role: Role.ADMIN,
      is_active: true,
      first_login: false,
    },
    select: { email: true },
  });

  return {
    email: createdAdmin.email,
    password: TEST_CREDENTIALS.adminPassword,
    created: true,
  };
};

const seedWarden = async () => {
  const hash = await bcrypt.hash(TEST_CREDENTIALS.wardenPassword, 10);

  const existing = await prisma.user.findUnique({
    where: { email: TEST_CREDENTIALS.wardenEmail },
    select: { id: true },
  });

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        full_name: "Test Warden",
        role: Role.WARDEN,
        password_hash: hash,
        first_login: false,
        is_active: true,
      },
    });

    return {
      email: TEST_CREDENTIALS.wardenEmail,
      password: TEST_CREDENTIALS.wardenPassword,
      created: false,
    };
  }

  const username = await ensureUniqueUsername("warden");
  await prisma.user.create({
    data: {
      full_name: "Test Warden",
      username,
      email: TEST_CREDENTIALS.wardenEmail,
      password_hash: hash,
      role: Role.WARDEN,
      is_active: true,
      first_login: false,
    },
  });

  return {
    email: TEST_CREDENTIALS.wardenEmail,
    password: TEST_CREDENTIALS.wardenPassword,
    created: true,
  };
};

const seedStudent = async () => {
  const hash = await bcrypt.hash(TEST_CREDENTIALS.studentPassword, 10);

  const admin = await prisma.user.findFirst({
    where: { role: Role.ADMIN },
    select: { id: true },
  });

  const existing = await prisma.user.findUnique({
    where: { email: TEST_CREDENTIALS.studentEmail },
    include: { student: true },
  });

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        full_name: "Test Student",
        role: Role.STUDENT,
        password_hash: hash,
        first_login: false,
        is_active: true,
      },
    });

    if (existing.student) {
      await prisma.student.update({
        where: { user_id: existing.id },
        data: {
          department: DEFAULT_STUDENT_DEPARTMENT,
          year_of_study: 2,
        },
      });

      await ensureDefaultRoomAllocation(existing.student.id, admin?.id);
    } else {
      const hostelId = await nextUniqueStudentField("hostel_id", "HOSTEL-STU-001");
      const enrollmentNo = await nextUniqueStudentField("enrollment_no", "ENROLL-STU-001");

      const createdStudent = await prisma.student.create({
        data: {
          user_id: existing.id,
          hostel_id: hostelId,
          enrollment_no: enrollmentNo,
          department: DEFAULT_STUDENT_DEPARTMENT,
          year_of_study: 2,
        },
        select: { id: true },
      });

      await ensureDefaultRoomAllocation(createdStudent.id, admin?.id);
    }

    return {
      email: TEST_CREDENTIALS.studentEmail,
      password: TEST_CREDENTIALS.studentPassword,
      created: false,
    };
  }

  const username = await ensureUniqueUsername("student");
  const hostelId = await nextUniqueStudentField("hostel_id", "HOSTEL-STU-001");
  const enrollmentNo = await nextUniqueStudentField("enrollment_no", "ENROLL-STU-001");

  const createdUser = await prisma.user.create({
    data: {
      full_name: "Test Student",
      username,
      email: TEST_CREDENTIALS.studentEmail,
      password_hash: hash,
      role: Role.STUDENT,
      is_active: true,
      first_login: false,
      student: {
        create: {
          hostel_id: hostelId,
          enrollment_no: enrollmentNo,
          department: DEFAULT_STUDENT_DEPARTMENT,
          year_of_study: 2,
        },
      },
    },
    include: { student: { select: { id: true } } },
  });

  if (createdUser.student) {
    await ensureDefaultRoomAllocation(createdUser.student.id, admin?.id);
  }

  return {
    email: TEST_CREDENTIALS.studentEmail,
    password: TEST_CREDENTIALS.studentPassword,
    created: true,
  };
};

const main = async () => {
  try {
    await prisma.$connect();

    const [admin, warden, student] = await Promise.all([
      seedAdmin(),
      seedWarden(),
      seedStudent(),
    ]);

    console.log("\nTest credentials ready:\n");
    console.log(`ADMIN   -> ${admin.email} / ${admin.password} (${admin.created ? "created" : "updated"})`);
    console.log(`WARDEN  -> ${warden.email} / ${warden.password} (${warden.created ? "created" : "updated"})`);
    console.log(`STUDENT -> ${student.email} / ${student.password} (${student.created ? "created" : "updated"})`);
    console.log("");
  } catch (error) {
    console.error("Failed to seed test users:", error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
};

void main();
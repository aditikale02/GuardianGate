import bcrypt from "bcryptjs";
import { Department, EntryAction, Role, RoomStatus, RoomType } from "@prisma/client";
import "../src/config/env.config";
import { prisma } from "../src/prisma";

const DEFAULT_PASSWORD = "PayDemo@123";
const STUDENTS_PER_ROOM = 3;
const ROOMS_PER_FLOOR = 6;
const FLOORS_PER_HOSTEL = 3;

const hostels = [
  { code: "HSTL-A", name: "North Hostel A" },
  { code: "HSTL-B", name: "South Hostel B" },
] as const;

const feeTemplates = [
  { fee_type: "Hostel Fee", amount: 25000 },
  { fee_type: "Mess Fee", amount: 12000 },
  { fee_type: "Security Deposit", amount: 8000 },
  { fee_type: "Maintenance Fee", amount: 4500 },
  { fee_type: "Other Charges", amount: 2200 },
] as const;

const departments: Department[] = [
  Department.COMPUTER_ENGINEERING,
  Department.AIML,
  Department.IT,
  Department.ENTC,
  Department.CIVIL,
  Department.ARCHITECTURE,
  Department.DIPLOMA,
  Department.COMPUTER_ENGINEERING_REGIONAL,
];

type DemoStudent = {
  studentId: string;
  name: string;
  email: string;
  username: string;
  phone: string;
  enrollmentNo: string;
  hostelId: string;
  department: Department;
  year: number;
  roomId: string;
  roomNumber: string;
  floor: number;
  hostelName: string;
  bedNumber: number;
};

const to2 = (n: number) => String(n).padStart(2, "0");
const to3 = (n: number) => String(n).padStart(3, "0");

const createDemoStudents = async () => {
  const students: DemoStudent[] = [];
  let seq = 1;

  for (let hostelIdx = 0; hostelIdx < hostels.length; hostelIdx += 1) {
    const hostel = hostels[hostelIdx];

    const block = await prisma.hostelBlock.upsert({
      where: { name: hostel.name },
      update: {},
      create: {
        name: hostel.name,
        description: `Payment demo block ${hostel.code}`,
      },
    });

    for (let floorNumber = 1; floorNumber <= FLOORS_PER_HOSTEL; floorNumber += 1) {
      const floor = await prisma.floor.upsert({
        where: {
          block_id_floor_number: {
            block_id: block.id,
            floor_number: floorNumber,
          },
        },
        update: {
          name: `Floor ${floorNumber}`,
        },
        create: {
          block_id: block.id,
          floor_number: floorNumber,
          name: `Floor ${floorNumber}`,
        },
      });

      for (let roomIdx = 1; roomIdx <= ROOMS_PER_FLOOR; roomIdx += 1) {
        const roomNumber = `${floorNumber}${to2(roomIdx)}`;

        const room = await prisma.room.upsert({
          where: {
            floor_id_room_number: {
              floor_id: floor.id,
              room_number: roomNumber,
            },
          },
          update: {
            room_type: RoomType.TRIPLE,
            capacity: 3,
            status: RoomStatus.ACTIVE,
          },
          create: {
            floor_id: floor.id,
            room_number: roomNumber,
            room_type: RoomType.TRIPLE,
            capacity: 3,
            status: RoomStatus.ACTIVE,
            current_occupancy: 0,
          },
        });

        for (let bed = 1; bed <= STUDENTS_PER_ROOM; bed += 1) {
          const idx = seq;
          const suffix = to3(idx);
          const studentId = `PAY-${hostelIdx + 1}${to2(floorNumber)}${to2(roomIdx)}${bed}`;

          students.push({
            studentId,
            name: `Payment Demo Student ${suffix}`,
            email: `paydemo.student${suffix}@guardian.com`,
            username: `paydemo${suffix}`,
            phone: `93${String(idx).padStart(8, "0")}`.slice(0, 10),
            enrollmentNo: `ENR-PAY-${hostelIdx + 1}${to2(floorNumber)}${to2(roomIdx)}-${bed}`,
            hostelId: `HOSTEL-PAY-${hostelIdx + 1}${to2(floorNumber)}${to2(roomIdx)}${bed}`,
            department: departments[idx % departments.length],
            year: ((idx - 1) % 4) + 1,
            roomId: room.id,
            roomNumber,
            floor: floorNumber,
            hostelName: hostel.name,
            bedNumber: bed,
          });

          seq += 1;
        }
      }
    }
  }

  return students;
};

const upsertStudentsWithRooms = async (students: DemoStudent[], adminId?: string) => {
  const hash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  const studentDbIds: string[] = [];

  for (const demo of students) {
    const existingUser = await prisma.user.findUnique({
      where: { email: demo.email },
      include: { student: true },
    });

    const user = existingUser
      ? await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            full_name: demo.name,
            username: demo.username,
            phone: demo.phone,
            role: Role.STUDENT,
            password_hash: hash,
            is_active: true,
            first_login: false,
          },
          include: { student: true },
        })
      : await prisma.user.create({
          data: {
            full_name: demo.name,
            username: demo.username,
            email: demo.email,
            phone: demo.phone,
            role: Role.STUDENT,
            password_hash: hash,
            is_active: true,
            first_login: false,
            created_by_admin_id: adminId,
          },
          include: { student: true },
        });

    const student = user.student
      ? await prisma.student.update({
          where: { user_id: user.id },
          data: {
            hostel_id: demo.hostelId,
            enrollment_no: demo.enrollmentNo,
            department: demo.department,
            year_of_study: demo.year,
            course_branch: "B.Tech",
            current_status: EntryAction.ENTRY,
          },
        })
      : await prisma.student.create({
          data: {
            user_id: user.id,
            hostel_id: demo.hostelId,
            enrollment_no: demo.enrollmentNo,
            department: demo.department,
            year_of_study: demo.year,
            course_branch: "B.Tech",
            current_status: EntryAction.ENTRY,
          },
        });

    studentDbIds.push(student.id);

    await prisma.roomAllocation.upsert({
      where: { student_id: student.id },
      update: {
        room_id: demo.roomId,
        bed_number: demo.bedNumber,
        is_active: true,
        vacated_at: null,
        allocated_by: adminId,
      },
      create: {
        student_id: student.id,
        room_id: demo.roomId,
        bed_number: demo.bedNumber,
        is_active: true,
        allocated_by: adminId,
      },
    });
  }

  return studentDbIds;
};

const reseedFeesAndPayments = async (studentIds: string[], adminId?: string) => {
  await prisma.payment.deleteMany({ where: { student_id: { in: studentIds } } });
  await prisma.feeRecord.deleteMany({ where: { student_id: { in: studentIds } } });

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  for (let studentIndex = 0; studentIndex < studentIds.length; studentIndex += 1) {
    const studentId = studentIds[studentIndex];
    const studentBucket = studentIndex % 6;

    for (let feeIndex = 0; feeIndex < feeTemplates.length; feeIndex += 1) {
      const template = feeTemplates[feeIndex];

      let scenario: "PAID" | "PARTIAL" | "PENDING" | "OVERDUE" = "PENDING";
      if (studentBucket === 0) scenario = "PAID";
      else if (studentBucket === 1) scenario = "PARTIAL";
      else if (studentBucket === 2) scenario = "PENDING";
      else if (studentBucket === 3) scenario = "OVERDUE";
      else if (studentBucket === 4) scenario = feeIndex % 2 === 0 ? "PAID" : "PARTIAL";
      else scenario = feeIndex < 2 ? "OVERDUE" : "PENDING";

      const dueDays =
        scenario === "OVERDUE"
          ? -24 - feeIndex
          : scenario === "PENDING"
            ? 14 + feeIndex
            : 28 + feeIndex;

      const dueDate = new Date(now + dueDays * dayMs);
      const amount = template.amount + ((studentIndex + feeIndex) % 7) * 350;

      const feeRecord = await prisma.feeRecord.create({
        data: {
          student_id: studentId,
          fee_type: template.fee_type,
          amount,
          due_date: dueDate,
          is_paid: scenario === "PAID",
        },
      });

      if (scenario === "PAID") {
        await prisma.payment.create({
          data: {
            student_id: studentId,
            fee_record_id: feeRecord.id,
            amount_paid: amount,
            payment_date: new Date(now - (7 + feeIndex) * dayMs),
            payment_mode: "UPI",
            receipt_no: `RCP-${studentIndex + 1}-${feeIndex + 1}`,
            recorded_by: adminId,
            remarks: "Paid in full before due date",
          },
        });
      }

      if (scenario === "PARTIAL") {
        const paidAmount = Math.round(amount * 0.55);
        await prisma.payment.create({
          data: {
            student_id: studentId,
            fee_record_id: feeRecord.id,
            amount_paid: paidAmount,
            payment_date: new Date(now - (2 + feeIndex) * dayMs),
            payment_mode: "Card",
            receipt_no: `RCP-${studentIndex + 1}-${feeIndex + 1}`,
            recorded_by: adminId,
            remarks: "Part payment received, remaining due",
          },
        });
      }

      if (scenario === "OVERDUE") {
        if ((studentIndex + feeIndex) % 4 === 0) {
          const paidAmount = Math.round(amount * 0.25);
          await prisma.payment.create({
            data: {
              student_id: studentId,
              fee_record_id: feeRecord.id,
              amount_paid: paidAmount,
              payment_date: new Date(now - (30 + feeIndex) * dayMs),
              payment_mode: "Cash",
              receipt_no: `RCP-${studentIndex + 1}-${feeIndex + 1}`,
              recorded_by: adminId,
              remarks: "Initial installment received, now overdue",
            },
          });
        }
      }
    }
  }
};

const syncRoomOccupancy = async () => {
  const rooms = await prisma.room.findMany({ select: { id: true } });
  for (const room of rooms) {
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
  }
};

const run = async () => {
  try {
    await prisma.$connect();

    const admin = await prisma.user.findFirst({
      where: { role: Role.ADMIN, is_active: true },
      select: { id: true },
    });

    const demoStudents = await createDemoStudents();
    const studentIds = await upsertStudentsWithRooms(demoStudents, admin?.id);
    await reseedFeesAndPayments(studentIds, admin?.id);
    await syncRoomOccupancy();

    console.log("\nAdmin payment demo data seeded successfully.\n");
    console.log(`Demo students: ${studentIds.length}`);
    console.log(`Fee records per student: ${feeTemplates.length}`);
    console.log(`Total fee records: ${studentIds.length * feeTemplates.length}`);
    console.log(`Default password for demo students: ${DEFAULT_PASSWORD}`);
    console.log("Use Admin login to test /admin/payments with full filters and statuses.\n");
  } catch (error) {
    console.error("Failed to seed admin payment demo data:", error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
};

void run();

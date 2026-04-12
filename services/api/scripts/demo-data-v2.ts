import bcrypt from "bcryptjs";
import { 
  Department, 
  Role, 
  ShiftTiming, 
  RequestStatus, 
  MedicalUrgency, 
  MedicalStatus, 
  ParcelStatus, 
  MaintenanceCategory, 
  HousekeepingCategory, 
  TaskStatus, 
  AttendanceStatus, 
  AlertPriority,
  RoomType,
  EntryAction
} from "@prisma/client";
import "../src/config/env.config";
import { env } from "../src/config/env.config";
import { prisma } from "../src/prisma";

const DEFAULT_PASSWORD = "Pass@123"; // Password for wardens and students
const ADMIN_EMAIL = env.DEFAULT_ADMIN_EMAIL || "admin@guardian.com";
const ADMIN_PASSWORD = env.DEFAULT_ADMIN_PASSWORD || "Admin@123";

const HOSTEL_NAME = "Savitribai Phule Premium Hostel";

const WARDEN_NAMES = [
  "Rajesh Kumar",
  "Suman Patil",
  "Vikram Singh",
  "Anita Deshmukh",
  "Sunil Verma"
];

const STUDENT_NAMES = [
  "Aarav Sharma", "Vivaan Iyer", "Arjun Nair", "Sai Reddy", "Aditya Gupta",
  "Prisha Mehra", "Ananya Joshi", "Ishaan Malhotra", "Aavya Singh", "Krishna Murthy",
  "Myra Kulkarni", "Kavya Reddy", "Rohan Das", "Siddharth Rao", "Diya Sharma",
  "Aryan Verma", "Anika Patil", "Kabir Khan", "Saanvi Iyer", "Advait Joshi",
  "Shanaya Gupta", "Vihaan Mehra", "Pari Singh", "Rudra Deshmukh", "Zara Khan",
  "Reyansh Malhotra", "Kyra Nair", "Atharv Rao", "Sara Murthy", "Daksh Reddy",
  "Aanya Das", "Yuvan Verma", "Navya Kulkarni", "Ayaan Patil", "Siya Singh",
  "Shauryas Malhotra", "Kiara Iyer", "Arnav Joshi", "Riya Gupta", "Ishani Mehra",
  "Kiaan Reddy", "Vanya Rao", "Dhruv Das", "Tanisha Sharma", "Devansh Murthy",
  "Ira Patil", "Shivaansh Singh", "Inaya Verma", "Veer Kulkarni", "Amoli Iyer"
];

const DEPARTMENTS = [
  Department.COMPUTER_ENGINEERING,
  Department.AIML,
  Department.IT,
  Department.ENTC,
  Department.CIVIL,
  Department.ARCHITECTURE
];

const randomElement = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomDate = (start: Date, end: Date) => new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));

const toUsername = (seed: string) =>
  seed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 24) || "user";

const ensureUniqueUsername = async (seed: string) => {
  const normalized = toUsername(seed);
  let candidate = normalized;
  for (let i = 1; i <= 1000; i += 1) {
    const existing = await prisma.user.findUnique({ where: { username: candidate }, select: { id: true } });
    if (!existing) return candidate;
    candidate = `${normalized}${i}`;
  }
  return `${normalized}${Date.now()}`;
};

async function run() {
  console.log("🚀 Starting Realistic Demo Data Seeding (V2)...");

  try {
    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
    const adminPasswordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

    // 1. Create/Update Hostel
    const hostel = await prisma.hostel.upsert({
      where: { id: "demo-hostel-id" }, // Static ID for consistency
      update: { name: HOSTEL_NAME },
      create: { id: "demo-hostel-id", name: HOSTEL_NAME }
    });
    console.log(`✅ Hostel ready: ${hostel.name}`);

    // 2. Setup Admin
    const adminUsername = await ensureUniqueUsername(ADMIN_EMAIL.split("@")[0]);
    const admin = await prisma.user.upsert({
      where: { email: ADMIN_EMAIL },
      update: {
        hostel_id: hostel.id,
        password_hash: adminPasswordHash,
        role: Role.ADMIN,
        is_active: true,
        first_login: false
      },
      create: {
        email: ADMIN_EMAIL,
        full_name: "Supreme Admin",
        username: adminUsername,
        password_hash: adminPasswordHash,
        role: Role.ADMIN,
        hostel_id: hostel.id,
        is_active: true,
        first_login: false
      }
    });
    console.log(`✅ Admin ready: ${admin.email}`);

    // 3. Create Blocks, Floors, Rooms
    const blocks = ["A", "B"];
    const createdRooms: any[] = [];
    
    for (const blockName of blocks) {
      let block = await prisma.hostelBlock.findFirst({
        where: { hostel_id: hostel.id, name: blockName }
      });

      if (!block) {
        block = await prisma.hostelBlock.create({
          data: {
            hostel_id: hostel.id,
            name: blockName,
            description: `Premium Block ${blockName}`
          }
        });
      }

      for (let f = 1; f <= 3; f++) {
        let floor = await prisma.floor.findFirst({
          where: { block_id: block.id, floor_number: f }
        });

        if (!floor) {
          floor = await prisma.floor.create({
            data: {
              block_id: block.id,
              floor_number: f,
              name: `Floor ${f}`
            }
          });
        }

        for (let r = 1; r <= 10; r++) {
          const roomNo = `${f}0${r}`;
          let room = await prisma.room.findFirst({
            where: { floor_id: floor.id, room_number: roomNo }
          });

          if (!room) {
            room = await prisma.room.create({
              data: {
                floor_id: floor.id,
                room_number: roomNo,
                room_type: RoomType.DOUBLE,
                capacity: 2,
                status: "ACTIVE"
              }
            });
          }
          createdRooms.push(room);
        }
      }
    }
    console.log(`✅ ${createdRooms.length} rooms ready.`);

    // 4. Create Wardens
    const wardens: any[] = [];
    const wardenIndianNames = ["Rajesh Kumar", "Suman Patil", "Vikram Singh", "Anita Deshmukh", "Sunil Verma"];
    for (let i = 0; i < wardenIndianNames.length; i++) {
        const name = wardenIndianNames[i];
        const email = `warden${i+1}@guardian.com`;
        
        let user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            const username = await ensureUniqueUsername(name.split(" ")[0]);
            user = await prisma.user.create({
                data: {
                    email,
                    full_name: name,
                    username,
                    role: Role.WARDEN,
                    hostel_id: hostel.id,
                    password_hash: passwordHash,
                    is_active: true,
                    first_login: false,
                    warden_profile: {
                        create: {
                            warden_id: `WRD${String(i+1).padStart(3, '0')}`,
                            assigned_hostel: HOSTEL_NAME,
                            assigned_block: i < 3 ? "A" : "B",
                            shift_timing: i % 2 === 0 ? ShiftTiming.DAY : ShiftTiming.NIGHT
                        }
                    }
                }
            });
        } else {
            user = await prisma.user.update({
                where: { id: user.id },
                data: {
                    hostel_id: hostel.id,
                    role: Role.WARDEN,
                    is_active: true,
                    first_login: false
                }
            });
        }
        wardens.push(user);
    }
    console.log(`✅ 5 Wardens ready.`);

    // 5. Create Students
    const students: any[] = [];
    for (let i = 0; i < STUDENT_NAMES.length; i++) {
        const name = STUDENT_NAMES[i];
        const email = `student${String(i+1).padStart(2, '0')}@guardian.com`;
        const enrollment = `ENR${2024000 + i}`;
        
        let user = await prisma.user.findUnique({ 
            where: { email },
            include: { student: true }
        });

        if (!user) {
            const username = await ensureUniqueUsername(name.split(" ")[0]);
            user = await prisma.user.create({
                data: {
                    email,
                    full_name: name,
                    username,
                    role: Role.STUDENT,
                    hostel_id: hostel.id,
                    password_hash: passwordHash,
                    is_active: true,
                    first_login: false,
                    student: {
                        create: {
                            hostel_id: hostel.id,
                            enrollment_no: enrollment,
                            department: randomElement(DEPARTMENTS),
                            year_of_study: randomInt(1, 4),
                            assigned_warden_id: randomElement(wardens).id,
                            guardian_phone: `98${randomInt(10000000, 99999999)}`,
                            permanent_address: "123 Main St, Pune, Maharashtra",
                            current_status: EntryAction.ENTRY
                        }
                    }
                },
                include: { student: true }
            });
        } else {
            user = await prisma.user.update({
                where: { id: user.id },
                data: {
                    hostel_id: hostel.id,
                    role: Role.STUDENT,
                    is_active: true,
                    first_login: false
                },
                include: { student: true }
            });
        }
        
        // Allocate Room
        if (user.student) {
            const room = createdRooms[Math.floor(i / 2)];
            const existingAllocation = await prisma.roomAllocation.findUnique({
                where: { student_id: user.student.id }
            });

            if (!existingAllocation) {
                await prisma.roomAllocation.create({
                    data: {
                        student_id: user.student.id,
                        room_id: room.id,
                        bed_number: (i % 2) + 1,
                        is_active: true,
                        allocated_by: admin.id
                    }
                });
            } else {
                await prisma.roomAllocation.update({
                    where: { student_id: user.student.id },
                    data: { room_id: room.id, is_active: true }
                });
            }
        }
        students.push(user.student);
    }
    console.log(`✅ 50 Students ready and allocated rooms.`);


    // 6. Populate Usage Data
    console.log("📦 Populating usage data...");

    // Notices
    await prisma.notice.createMany({
        data: [
            { title: "Hostel Annual Day Celebration", content: "We are celebrating our annual day on 25th April. All students must attend.", created_by: admin.id, target_role: Role.STUDENT },
            { title: "Maintenance Alert", content: "Water supply will be suspended for 2 hours on Sunday for tank cleaning.", created_by: admin.id, target_role: Role.STUDENT },
            { title: "Staff Meeting", content: "Urgent meeting for all wardens in the office at 4 PM today.", created_by: admin.id, target_role: Role.WARDEN }
        ]
    });

    // Events
    await prisma.event.createMany({
        data: [
            { title: "Inter-Hostel Cricket Match", description: "Final match against Block B.", event_date: new Date(Date.now() + 86400000 * 5), location: "Main Ground", created_by: admin.id },
            { title: "Career Counseling Workshop", description: "Interaction with industry experts.", event_date: new Date(Date.now() + 86400000 * 10), location: "Seminar Hall", created_by: admin.id }
        ]
    });

    // Usage Loop for diversity
    for (let i = 0; i < 30; i++) {
        const student = randomElement(students);
        const warden = randomElement(wardens);

        // Maintenance
        if (i < 10) {
            await prisma.maintenanceRequest.create({
                data: {
                    student_id: student.id,
                    room_id: student.room_allocation_room_id || createdRooms[0].id, // fallback
                    category: randomElement([MaintenanceCategory.ELECTRICAL, MaintenanceCategory.PLUMBING]),
                    description: "Fan making noise / Light flickering",
                    status: randomElement([TaskStatus.PENDING, TaskStatus.IN_PROGRESS, TaskStatus.RESOLVED])
                }
            });
        }

        // Leave Requests
        if (i < 15) {
            await prisma.nightLeaveRequest.create({
                data: {
                    student_id: student.id,
                    reason: "Visiting parents for weekend",
                    destination: "Home",
                    departure_at: randomDate(new Date(), new Date(Date.now() + 86400000 * 7)),
                    return_at: randomDate(new Date(Date.now() + 86400000 * 8), new Date(Date.now() + 86400000 * 10)),
                    status: randomElement([RequestStatus.PENDING, RequestStatus.APPROVED, RequestStatus.REJECTED]),
                    reviewed_by: warden.id
                }
            });
        }

        // Complaints (Missing Reports as a proxy for complaints/item issues)
        if (i < 5) {
            await prisma.missingReport.create({
                data: {
                    student_id: student.id,
                    title: "Missing Earbuds",
                    description: "Lost my boat earbuds in the mess area.",
                    location: "Mess Hall",
                    status: "OPEN"
                }
            });
        }

        // Parcels
        if (i < 12) {
            await prisma.parcelRecord.create({
                data: {
                    student_id: student.id,
                    description: "Amazon Package / Zomato Delivery",
                    sender_name: "E-Kart",
                    status: randomElement([ParcelStatus.RECEIVED, ParcelStatus.COLLECTED]),
                    delivered_by: warden.id
                }
            });
        }
    }

    // 7. Attendance Records for Dashboard
    const today = new Date();
    for (let d = 0; d < 7; d++) {
        const date = new Date();
        date.setDate(today.getDate() - d);
        for (const student of students) {
            await prisma.attendanceRecord.upsert({
                where: { student_id_attendance_date: { student_id: student.id, attendance_date: date } },
                update: {},
                create: {
                    student_id: student.id,
                    attendance_date: date,
                    attendance_status: Math.random() > 0.1 ? AttendanceStatus.PRESENT : AttendanceStatus.ABSENT,
                    is_finalized: true
                }
            });
        }
    }

    // 8. Food Menu
    const meals = ["BREAKFAST", "LUNCH", "DINNER"];
    for (let d = -1; d < 3; d++) {
        const date = new Date();
        date.setDate(today.getDate() + d);
        for (const meal of meals) {
            await prisma.foodMenu.upsert({
                where: { menu_date_meal_type: { menu_date: date, meal_type: meal } },
                update: {},
                create: {
                    menu_date: date,
                    meal_type: meal,
                    items: "Poha, Tea / Thali / Chapati, Paneer, Rice"
                }
            });
        }
    }

    console.log("✨ Demo data seeding completed successfully!");
    console.log("-----------------------------------------");
    console.log(`Admin email: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
    console.log(`Wardens: warden1@guardian.com to warden5@guardian.com / ${DEFAULT_PASSWORD}`);
    console.log(`Students: student01@guardian.com to student50@guardian.com / ${DEFAULT_PASSWORD}`);
    console.log("-----------------------------------------");

  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

void run();

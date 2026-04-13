import { createClient } from '@supabase/supabase-js';
import { prisma } from '../src/prisma';
import { Role, RoomType, RoomStatus, AttendanceStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});


const INDIAN_FEMALE_NAMES = [
  "Aditi Sharma", "Ananya Iyer", "Diya Mukherjee", "Ishani Singh", "Kavya Reddy", 
  "Myra Kapoor", "Navya Nair", "Prisha Gupta", "Riya Verma", "Saanvi Rao", 
  "Tanvi Joshi", "Vanya Malhotra", "Zara Khan", "Bhavna Patel", "Chitra Deshmukh", 
  "Deepa Menon", "Esha Choudhury", "Fatima Sheikh", "Gauri Kulkarni", "Himani Shah", 
  "Indu Balakrishnan", "Jyoti Saxena", "Kiran Pandey", "Lata Mangeshkar", "Meera Das", 
  "Neha Aggarwal", "Pooja Hegde", "Radha Krishnan", "Suman Lata", "Uma Bharti", 
  "Vidya Balan", "Yamini Krishnamurthy", "Priyanka Chopra", "Shweta Tiwari", "Aarti Chhabria", 
  "Sunita Williams", "Rajeshwari Sachdev", "Meenakshi Sheshadri", "Anjali Devi", "Sneha Ullal", 
  "Shruti Haasan", "Preeti Zinta", "Kajal Aggarwal", "Ritu Beri", "Sakshi Tanwar", 
  "Shalini Pandey", "Tanu Weds Manu", "Vaishali Samant", "Varsha Usgaonkar", "Swati Maliwal",
  "Rashmi Desai", "Monica Bedi", "Amrita Singh", "Karishma Kapoor", "Kareena Kapoor",
  "Deepika Padukone", "Alia Bhatt", "Shraddha Kapoor", "Sara Ali Khan", "Janhvi Kapoor",
  "Sushmita Sen", "Aishwarya Rai", "Madhuri Dixit", "Sridevi Boney", "Juhi Chawla"
];

const WARDEN_NAMES = [
  "Dr. Sunita Deshpande", "Mrs. Rajeshwari Nair", "Ms. Meenakshi Iyer", 
  "Prof. Aarti Sharma", "Dr. Shalini Kulkarni"
];

async function clearData() {
  console.log("Cleaning existing data from public schema...");
  // We don't delete from Supabase Auth automatically here to avoid accidents, 
  // but we clean our local tables.
  const tables = [
    'AttendanceRecord', 'NightLeaveRequest', 'MaintenanceRequest', 
    'Notice', 'Event', 'RoomAllocation', 'Student', 'WardenProfile', 'User', 
    'Room', 'Floor', 'HostelBlock', 'Hostel', 'FoodMenu'
  ];
  
  for (const table of tables) {
    try {
      await (prisma as any)[table.charAt(0).toLowerCase() + table.slice(1)].deleteMany({});
    } catch (e) {
      console.warn(`Could not clear table ${table}: ${e.message}`);
    }
  }
}

async function createAuthUser(email: string, password: string, fullName: string, role: string) {
  console.log(`Creating Auth user: ${email} (${role})...`);
  
  // Check if user exists in Auth
  const { data: existing, error: findError } = await supabase.auth.admin.listUsers();
  const existingUser = existing?.users.find(u => u.email === email);
  
  if (existingUser) {
    console.log(`User ${email} already exists in Supabase Auth. Deleting and recreating for clean state...`);
    await supabase.auth.admin.deleteUser(existingUser.id);
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, role: role }
  });

  if (error) {
    console.error(`Error creating auth user ${email}:`, error.message);
    return null;
  }

  return data.user;
}

async function main() {
  // 1. Clear Data
  await clearData();

  // 2. Create Hostel
  const hostel = await prisma.hostel.create({
    data: {
      name: "Savitribai Phule Government Girls Hostel",
    }
  });
  console.log("✅ Created Hostel");

  const block = await prisma.hostelBlock.create({
    data: {
      hostel_id: hostel.id,
      name: "Main Block",
      description: "Primary residential block for undergraduate students"
    }
  });

  const floor = await prisma.floor.create({
    data: {
      block_id: block.id,
      floor_number: 1,
      name: "Ground Floor"
    }
  });

  // 3. Create Admin
  const adminEmail = "admin@guardian.com";
  const adminPass = "Admin@123";
  const adminName = "Smt. Rekha Sharma (Chief Admin)";
  
  const authAdmin = await createAuthUser(adminEmail, adminPass, adminName, "ADMIN");
  if (authAdmin) {
    const passwordHash = await bcrypt.hash(adminPass, 10);
    await prisma.user.create({
      data: {
        id: authAdmin.id,
        hostel_id: hostel.id,
        username: "admin_main",
        email: adminEmail,
        password_hash: passwordHash,
        role: Role.ADMIN,
        full_name: adminName,
        is_active: true,
        first_login: false
      }
    });
    console.log("✅ Created Admin in Auth and DB");
  }

  // 4. Create Wardens
  const wardens = [];
  for (let i = 0; i < 5; i++) {
    const name = WARDEN_NAMES[i];
    const email = `warden${i + 1}@guardian.com`;
    const pass = "Pass@123";
    
    const authWarden = await createAuthUser(email, pass, name, "WARDEN");
    if (authWarden) {
      const passwordHash = await bcrypt.hash(pass, 10);
      const user = await prisma.user.create({
        data: {
          id: authWarden.id,
          hostel_id: hostel.id,
          username: `warden_${i + 1}`,
          email: email,
          password_hash: passwordHash,
          role: Role.WARDEN,
          full_name: name,
          is_active: true,
          first_login: false
        }
      });
      
      await prisma.wardenProfile.create({
        data: {
          user_id: user.id,
          employee_id: `EMP-W-${100 + i}`,
          phone: `987654321${i}`,
          is_chief_warden: i === 0
        }
      });
      wardens.push(user);
    }
  }
  console.log("✅ Created 5 Wardens in Auth and DB");

  // 5. Create Students and Rooms
  const students = [];
  const departments = ["Computer Engineering", "Information Technology", "Electronics", "Mechanical", "Civil"];
  
  for (let i = 0; i < 50; i++) {
    const roomNum = 100 + Math.floor(i / 2);
    let currentRoom;
    
    // Create room if it doesn't exist
    currentRoom = await prisma.room.findFirst({
      where: { floor_id: floor.id, room_number: roomNum.toString() }
    });
    
    if (!currentRoom) {
      currentRoom = await prisma.room.create({
        data: {
          floor_id: floor.id,
          room_number: roomNum.toString(),
          room_type: RoomType.DOUBLE,
          capacity: 2,
          current_occupancy: 0,
          status: RoomStatus.AVAILABLE
        }
      });
    }

    const name = INDIAN_FEMALE_NAMES[i % INDIAN_FEMALE_NAMES.length];
    const email = `student${(i + 1).toString().padStart(2, '0')}@guardian.com`;
    const pass = "Pass@123";
    
    const authStudent = await createAuthUser(email, pass, name, "STUDENT");
    if (authStudent) {
      const passwordHash = await bcrypt.hash(pass, 10);
      const user = await prisma.user.create({
        data: {
          id: authStudent.id,
          hostel_id: hostel.id,
          username: `student_${(i + 1).toString().padStart(2, '0')}`,
          email: email,
          password_hash: passwordHash,
          role: Role.STUDENT,
          full_name: name,
          is_active: true,
          first_login: false
        }
      });

      const student = await prisma.student.create({
        data: {
          user_id: user.id,
          enrollment_no: `ENR-24-${1000 + i}`,
          department: departments[i % departments.length],
          year_of_study: (i % 4) + 1,
          parent_name: "Shri " + name.split(' ')[1] + " Prasad",
          parent_phone: `912345678${i % 10}`,
          address: "Sample Address in India, Street No " + i,
          status: "RESIDENT"
        }
      });

      await prisma.roomAllocation.create({
        data: {
          student_id: student.id,
          room_id: currentRoom.id,
          is_active: true
        }
      });

      // Update occupancy
      await prisma.room.update({
        where: { id: currentRoom.id },
        data: { current_occupancy: { increment: 1 } }
      });

      students.push(student);
    }
  }
  console.log("✅ Created 50 Students in Auth and DB (with Room Allocations)");

  // 6. Secondary Module Data
  console.log("Populating interaction data...");
  
  // Notices
  await prisma.notice.create({
    data: {
      hostel_id: hostel.id,
      title: "Night Out Policy Reminder",
      content: "All resident students must report by 9:00 PM. Late returns require prior permission from the Chief Warden.",
      category: "RULE",
      priority: "HIGH",
      posted_by_id: wardens[0].id
    }
  });

  // Maintenance
  for (let i = 0; i < 5; i++) {
    await prisma.maintenanceRequest.create({
      data: {
        student_id: students[i].id,
        category: "PLUMBING",
        title: "Tap leakage in washroom",
        description: "The tap in room " + (100 + Math.floor(i/2)) + " is leaking continuously.",
        status: "PENDING",
        priority: "MEDIUM"
      }
    });
  }

  // Attendance (Last 3 days)
  for (const student of students) {
    for (let d = 0; d < 3; d++) {
      const date = new Date();
      date.setDate(date.getDate() - d);
      await prisma.attendanceRecord.create({
        data: {
          student_id: student.id,
          attendance_date: date,
          attendance_status: (Math.random() > 0.1) ? AttendanceStatus.PRESENT : AttendanceStatus.LATE,
          is_finalized: true
        }
      });
    }
  }

  console.log("✅ Populated secondary module data (Notices, Maintenance, Attendance)");

  console.log("\n🚀 SEEDING COMPLETED SUCCESSFULLY!");
  console.log("-----------------------------------------");
  console.log("Admin Email:", adminEmail);
  console.log("Credentials Issued: See tables above.");
  console.log("All student and warden users created in Supabase Auth.");
  console.log("-----------------------------------------");
}

main().catch(e => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});

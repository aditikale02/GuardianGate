import mongoose from "mongoose";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import { User } from "../src/models/User";
import { Student } from "../src/models/Student";

dotenv.config();

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/guardian-gate";

const seedParent = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB");

    const parentEmail = "parent@guardian.com";
    const hashedPassword = await bcrypt.hash("parent123", 10);

    // 1. Create or Update Parent User
    let parent = await User.findOne({ email: parentEmail });
    if (parent) {
      console.log("Parent user already exists");
      parent.password_hash = hashedPassword;
      parent.role = "PARENT";
      await parent.save();
    } else {
      parent = await User.create({
        name: "Mr. Sharma",
        email: parentEmail,
        password_hash: hashedPassword,
        role: "PARENT",
        is_active: true,
      });
      console.log("Parent user created");
    }

    // 2. Find a Student to link (or create one if none exist)
    let student = await Student.findOne({ enrollment_no: "DEMO001" });
    if (!student) {
      // If no demo student, link to the first available student or create a demo one
      student = await Student.findOne();
      if (!student) {
        student = await Student.create({
          name: "Rahul Sharma",
          email: "rahul@guardian.com",
          password_hash: await bcrypt.hash("student123", 10),
          role: "STUDENT",
          enrollment_no: "DEMO001",
          room_no: "101-B",
          current_status: "IN",
          parent_id: parent._id,
        });
        console.log("Demo student created and linked");
      } else {
        student.parent_id = parent._id as mongoose.Types.ObjectId;
        await student.save();
        console.log(`Linked parent to existing student: ${student.name}`);
      }
    } else {
      student.parent_id = parent._id as mongoose.Types.ObjectId;
      await student.save();
      console.log(`Linked parent to demo student: ${student.name}`);
    }

    console.log("Seeding completed successfully");
    process.exit(0);
  } catch (error) {
    console.error("Error seeding parent:", error);
    process.exit(1);
  }
};

seedParent();

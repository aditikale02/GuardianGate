import mongoose from "mongoose";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import { User } from "../src/models/User";

dotenv.config();

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/guardian-gate";

const seedAdmin = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB");

    const adminEmail = "admin@guardian.com";
    const hashedPassword = await bcrypt.hash("admin123", 10);

    const existingAdmin = await User.findOne({ email: adminEmail });
    if (existingAdmin) {
      console.log("Admin user already exists");
      existingAdmin.password_hash = hashedPassword;
      existingAdmin.role = "WARDEN";
      await existingAdmin.save();
      console.log("Admin password/role updated");
    } else {
      await User.create({
        name: "Chief Warden",
        email: adminEmail,
        password_hash: hashedPassword,
        role: "WARDEN",
        is_active: true,
      });
      console.log("Admin user created");
    }

    process.exit(0);
  } catch (error) {
    console.error("Error seeding admin:", error);
    process.exit(1);
  }
};

seedAdmin();

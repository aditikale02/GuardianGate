import { Client } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function main() {
    await client.connect();
    console.log("Checking if Hostel table exists...");
    const check = await client.query("SELECT * FROM information_schema.tables WHERE table_name = 'Hostel'");
    if (check.rowCount === 0) {
        console.log("Creating Hostel table...");
        await client.query(`CREATE TABLE "Hostel" (
            "id" TEXT NOT NULL,
            "name" TEXT NOT NULL,
            "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "Hostel_pkey" PRIMARY KEY ("id")
        )`);
        console.log("✅ Hostel table created!");
    } else {
        console.log("✅ Hostel table already exists.");
    }
    await client.end();
}

main().catch(console.error);

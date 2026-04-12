import { Client } from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
dotenv.config();

const databaseUrl = process.env.DATABASE_URL;

async function main() {
    console.log("Reading SQL files...");
    const cleanupSql = fs.readFileSync(path.join(__dirname, '..', 'cleanup.sql'), 'utf-8');
    const schemaSql = fs.readFileSync(path.join(__dirname, '..', 'schema.sql'), 'utf-8');
    
    const client = new Client({
        connectionString: databaseUrl,
        ssl: { rejectUnauthorized: false }
    });

    console.log("Connecting to Supabase...");
    await client.connect();

    console.log("Cleaning up public schema...");
    await client.query(cleanupSql);

    console.log("Applying entire schema at once...");
    try {
        await client.query(schemaSql);
        console.log("✅ Schema application complete!");
    } catch (e) {
        console.error("❌ Failed to apply schema:", e);
        process.exit(1);
    }

    await client.end();
}

main().catch(console.error);

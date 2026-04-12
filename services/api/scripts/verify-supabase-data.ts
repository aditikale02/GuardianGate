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
    const tables = ['Hostel', 'User', 'Student', 'WardenProfile', 'Notice', 'Event', 'MaintenanceRequest', 'NightLeaveRequest', 'AttendanceRecord', 'FoodMenu'];
    
    console.log("Supabase Data Stats:");
    for (const table of tables) {
        try {
            const res = await client.query('SELECT count(*) FROM "' + table + '"');
            console.log('- ' + table + ': ' + res.rows[0].count);
        } catch (e: any) {
            console.log('- ' + table + ': ERROR (' + e.message + ')');
        }
    }
    await client.end();
}

main().catch(console.error);

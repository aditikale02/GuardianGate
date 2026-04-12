const { Pool } = require('pg');

const test = async () => {
    const pool = new Pool({
        connectionString: "postgresql://postgres.myjeqrfphmjnvvqmrkxq:%40GuardianGate_2026@db.myjeqrfphmjnvvqmrkxq.supabase.co:5432/postgres",
        connectionTimeoutMillis: 5000,
    });
    try {
        const client = await pool.connect();
        const res = await client.query('SELECT NOW()');
        console.log("Direct connection successful", res.rows[0]);
        client.release();
    } catch (e) {
        console.error("Direct connection failed", e.message);
    }

    const pool2 = new Pool({
        connectionString: "postgresql://postgres.myjeqrfphmjnvvqmrkxq:%40GuardianGate_2026@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true",
        connectionTimeoutMillis: 5000,
    });
    try {
        const client = await pool2.connect();
        const res = await client.query('SELECT NOW()');
        console.log("Pooler connection successful", res.rows[0]);
        client.release();
    } catch (e) {
        console.error("Pooler connection failed", e.message);
    }
    process.exit(0);
}

test();

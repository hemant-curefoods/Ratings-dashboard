import pg from 'pg';
import 'dotenv/config';

// Connection string to the target 'website' database
const connectionString = process.env.DATABASE_URL || "postgresql://new_user:StrongPassword123!@103.172.150.31/website";

export const pool = new pg.Pool({
  connectionString,
  max: 20, // Max clients in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

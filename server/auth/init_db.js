import { pool } from '../ratings/db.js';
import bcrypt from 'bcryptjs';

async function initAuthDB() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS authorized_users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Check if admin exists
    const res = await client.query('SELECT id FROM authorized_users WHERE email = $1', ['ajel.henry@curefoods.in']);
    if (res.rows.length === 0) {
      console.log('Inserting default admin user ajel.henry@curefoods.in...');
      const hashedPassword = await bcrypt.hash('Curefoods@2026', 10);
      await client.query(
        'INSERT INTO authorized_users (email, password_hash, role) VALUES ($1, $2, $3)',
        ['ajel.henry@curefoods.in', hashedPassword, 'admin']
      );
      console.log('Admin user created successfully.');
    } else {
      console.log('Admin user already exists.');
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error initializing Auth DB:', err);
  } finally {
    client.release();
  }
}

initAuthDB()
  .then(() => process.exit(0))
  .catch(console.error);

const pool = require('./db');

async function createTables() {
  try {
    // Create otps table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS otps (
        id SERIAL PRIMARY KEY,
        flatNo TEXT NOT NULL,
        otp TEXT NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ otps table created or already exists.');

    // Create owners table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS owners (
        id SERIAL PRIMARY KEY,
        flatNo TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        contact TEXT NOT NULL,
        sqft INTEGER NOT NULL,
        parking TEXT,
        email TEXT
      );
    `);
    console.log('✅ owners table created or already exists.');

    // Create expenses table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS expenses (
        id SERIAL PRIMARY KEY,
        category TEXT NOT NULL,
        amount NUMERIC NOT NULL,
        date DATE NOT NULL,
        note TEXT
      );
    `);
    console.log('✅ expenses table created or already exists.');

    // Create receipts table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS receipts (
        id SERIAL PRIMARY KEY,
        receiptId TEXT NOT NULL UNIQUE,
        date DATE NOT NULL,
        flatNo TEXT NOT NULL,
        name TEXT NOT NULL,
        month TEXT NOT NULL,
        mode TEXT NOT NULL,
        txnId TEXT NOT NULL,
        amount NUMERIC NOT NULL
      );
    `);
    console.log('✅ receipts table created or already exists.');

    // Create announcements table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS announcements (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        body TEXT,
        date DATE NOT NULL
      );
    `);
    console.log('✅ announcements table created or already exists.');

    // Create complaints table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS complaints (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        date DATE NOT NULL,
        flatNo TEXT,
        status TEXT DEFAULT 'Open'
      );
    `);
    console.log('✅ complaints table created or already exists.');

    // Create settings table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS settings (
        id SERIAL PRIMARY KEY,
        setting_key TEXT NOT NULL UNIQUE,
        value TEXT NOT NULL
      );
    `);
    console.log('✅ settings table created or already exists.');

    console.log('🎉 All tables created successfully!');
  } catch (err) {
    console.error('❌ Error creating tables:', err.message);
  } finally {
    pool.end();
  }
}

createTables();

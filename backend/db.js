const { Pool } = require("pg");

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgresql://mangla_landmark_db_user:JmRg71RdnCpKHnRMK7mvADnucUbhAW9Z@dpg-d2tcj17diees7384j7mg-a/mangla_landmark_db",
  ssl: process.env.DATABASE_URL
    ? { rejectUnauthorized: false } // in production (Render)
    : false                         // in local dev
});

module.exports = pool;

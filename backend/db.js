const { Pool } = require("pg");
const pool = new Pool({
  connectionString: process.env.DATABASE_URL ||
    "postgresql://neondb_owner:npg_pdHhS1jaR6Nx@ep-dawn-bread-af4yuhpv-pooler.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
  ssl: { rejectUnauthorized: false }
});
module.exports = pool;


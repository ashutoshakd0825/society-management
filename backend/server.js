const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
require('./scheduler'); // ensures scheduler runs when server starts

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// ===== Database Connection =====
const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgresql://mangla_landmark_db_user:JmRg71RdnCpKHnRMK7mvADnucUbhAW9Z@dpg-d2tcj17diees7384j7mg-a/mangla_landmark_db",
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// ===== Create Tables if not exist =====
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS owners (
        id SERIAL PRIMARY KEY,
        flatNo TEXT,
        name TEXT,
        contact TEXT,
        sqft INT,
        parking TEXT,
        email TEXT             -- ✅ ADD this line

      );
      CREATE TABLE IF NOT EXISTS expenses (
        id SERIAL PRIMARY KEY,
        category TEXT,
        amount NUMERIC,
        date TEXT,
        note TEXT
      );
      CREATE TABLE IF NOT EXISTS receipts (
        id SERIAL PRIMARY KEY,
        receiptId TEXT,
        date TEXT,
        flatNo TEXT,
        name TEXT,
        month TEXT,
        mode TEXT,
        txnId TEXT,
        amount NUMERIC
      );
      CREATE TABLE IF NOT EXISTS announcements (
        id SERIAL PRIMARY KEY,
        title TEXT,
        date TEXT
      );
    `);
    console.log("✅ Tables ensured");
  } catch (err) {
    console.error("❌ Error creating tables:", err);
  }
}
initDB();

// ===== Safe Tables =====
const validTables = ["owners", "expenses", "receipts", "announcements"];

// ===== Test Endpoint =====
app.get("/api/test", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json({ success: true, time: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ===== GET all =====
app.get("/api/:type", async (req, res) => {
  const type = req.params.type;
  if (!validTables.includes(type)) {
    return res.status(400).json({ error: "Invalid table" });
  }
  try {
    const result = await pool.query(`SELECT * FROM ${type} ORDER BY id DESC`);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ===== ADD new =====
app.post("/api/:type", async (req, res) => {
  const type = req.params.type;
  if (!validTables.includes(type)) {
    return res.status(400).json({ error: "Invalid table" });
  }

  let query = "";
  let values = [];

  try {
  if (type === "owners") {
  query =
    "INSERT INTO owners(flatNo, name, contact, sqft, parking, email) VALUES($1,$2,$3,$4,$5,$6) RETURNING *";
  values = [
    req.body.flatNo,
    req.body.name,
    req.body.contact,
    req.body.sqft,
    req.body.parking,
    req.body.email              // ✅ ADD this
  ];
}

    if (type === "expenses") {
      query =
        "INSERT INTO expenses(category, amount, date, note) VALUES($1,$2,$3,$4) RETURNING *";
      values = [req.body.category, req.body.amount, req.body.date, req.body.note];
    }
    if (type === "receipts") {
      query =
        "INSERT INTO receipts(receiptId, date, flatNo, name, month, mode, txnId, amount) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *";
      values = [
        req.body.receiptId,
        req.body.date,
        req.body.flatNo,
        req.body.name,
        req.body.month,
        req.body.mode,
        req.body.txnId,
        req.body.amount
      ];
    }
    if (type === "announcements") {
      query =
        "INSERT INTO announcements(title, date) VALUES($1,$2) RETURNING *";
      values = [req.body.title, req.body.date];
    }

    const result = await pool.query(query, values);
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ===== DELETE by id =====
app.delete("/api/:type/:id", async (req, res) => {
  const type = req.params.type;
  if (!validTables.includes(type)) {
    return res.status(400).json({ error: "Invalid table" });
  }

  try {
    await pool.query(`DELETE FROM ${type} WHERE id=$1`, [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ===== Start Server =====
app.listen(PORT, () =>
  console.log(`✅ Server running on port ${PORT}`)
);

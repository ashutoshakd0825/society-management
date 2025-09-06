const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }   // Render ke DB ke liye required
});


// ===== Create Tables if not exist =====
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS owners (
      id SERIAL PRIMARY KEY,
      flatNo TEXT,
      name TEXT,
      contact TEXT,
      sqft INT,
      parking TEXT
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
}
initDB();

// ===== API Routes =====
// GET all
app.get("/api/:type", async (req, res) => {
  const type = req.params.type;
  const result = await pool.query(`SELECT * FROM ${type} ORDER BY id DESC`);
  res.json(result.rows);
});

// ADD new
app.post("/api/:type", async (req, res) => {
  const type = req.params.type;
  let query = "";
  let values = [];

  if(type === "owners") {
    query = "INSERT INTO owners(flatNo, name, contact, sqft, parking) VALUES($1,$2,$3,$4,$5) RETURNING *";
    values = [req.body.flatNo, req.body.name, req.body.contact, req.body.sqft, req.body.parking];
  }
  if(type === "expenses") {
    query = "INSERT INTO expenses(category, amount, date, note) VALUES($1,$2,$3,$4) RETURNING *";
    values = [req.body.category, req.body.amount, req.body.date, req.body.note];
  }
  if(type === "receipts") {
    query = "INSERT INTO receipts(receiptId, date, flatNo, name, month, mode, txnId, amount) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *";
    values = [req.body.receiptId, req.body.date, req.body.flatNo, req.body.name, req.body.month, req.body.mode, req.body.txnId, req.body.amount];
  }
  if(type === "announcements") {
    query = "INSERT INTO announcements(title, date) VALUES($1,$2) RETURNING *";
    values = [req.body.title, req.body.date];
  }

  const result = await pool.query(query, values);
  res.json(result.rows[0]);
});

// DELETE by id
app.delete("/api/:type/:id", async (req, res) => {
  const type = req.params.type;
  const id = req.params.id;
  await pool.query(`DELETE FROM ${type} WHERE id=$1`, [id]);
  res.json({ success: true });
});

app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));


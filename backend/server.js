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
        email TEXT
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
        body TEXT,
        date TEXT
      );
      CREATE TABLE IF NOT EXISTS settings (
        setting_key TEXT PRIMARY KEY,
        value TEXT
      );
      CREATE TABLE IF NOT EXISTS complaints (
  id SERIAL PRIMARY KEY,
  flatNo TEXT,
  ownerName TEXT,
  body TEXT,
  is_public BOOLEAN DEFAULT TRUE,
  status TEXT DEFAULT 'open',
  admin_comments TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
  );
    `);
    console.log("✅ Tables ensured");
  } catch (err) {
    console.error("❌ Error creating tables:", err);
  }
}
initDB();
// ===== Auto-clean complaints older than 2 months (runs daily) =====
async function cleanupOldComplaints() {
  try {
    // delete complaints older than 61 days
    await pool.query("DELETE FROM complaints WHERE created_at < NOW() - INTERVAL '61 days'");
    console.log("✅ Old complaints cleanup done");
  } catch (err) {
    console.error("Error cleaning complaints:", err);
  }
}

// ===== Safe Tables =====
const validTables = ["owners", "expenses", "receipts", "announcements", "complaints"];

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

// ===== GET Balance Summary (keep ABOVE /api/:type) =====
app.get("/api/balance", async (req, res) => {
  const { month, year } = req.query;

  try {
    const [receipts, expenses, settings] = await Promise.all([
      pool.query("SELECT amount, date FROM receipts"),
      pool.query("SELECT amount, date FROM expenses"),
      pool.query("SELECT value FROM settings WHERE setting_key = 'initial_balance'")
    ]);

    // Filter by month/year
    const filterByMonthYear = (rows) => rows.filter(row => {
      const d = new Date(row.date);
      return (!month || (d.getMonth() + 1) == month) && (!year || d.getFullYear() == year);
    });

    const filteredReceipts = filterByMonthYear(receipts.rows);
    const filteredExpenses = filterByMonthYear(expenses.rows);

    const totalCollection = filteredReceipts.reduce((sum, r) => sum + Number(r.amount || 0), 0);
    const totalExpenses = filteredExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const initialBalance = Number(settings.rows[0]?.value || 0);

    const balance = initialBalance + totalCollection - totalExpenses;

    res.json({
      initialBalance,
      totalCollection,
      totalExpenses,
      balance
    });
  } catch (err) {
    console.error("❌ Error in balance API:", err);
    res.status(500).json({ error: err.message });
  }
});

// ===== GET Setting by key =====
app.get("/api/settings/:key", async (req, res) => {
  const setting_key = req.params.key;
  try {
    const result = await pool.query("SELECT value FROM settings WHERE setting_key = $1", [setting_key]);
    if (result.rows.length > 0) {
      res.json({ setting_key, value: result.rows[0].value });
    } else {
      res.status(404).json({ error: "Setting not found" });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== POST Setting (insert or update) ===== ✅ FIXED: kept above /api/:type
app.post("/api/settings", async (req, res) => {
  const { setting_key, value } = req.body;
  try {
    const result = await pool.query(`
      INSERT INTO settings (setting_key, value)
      VALUES ($1, $2)
      ON CONFLICT (setting_key)
      DO UPDATE SET value = EXCLUDED.value
      RETURNING *;
    `, [setting_key, value]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
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
        req.body.email
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
        "INSERT INTO announcements(title, body, date) VALUES($1,$2,$3) RETURNING *";
      values = [req.body.title, req.body.body, req.body.date];
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
// ===== Complaints API =====
// GET complaints (returns public ones + private ones depending on viewerRole/viewerFlat)
app.get("/api/complaints", async (req, res) => {
  const { viewerRole = 'Guest', viewerFlat = '' } = req.query;
  try {
    // fetch all complaints
    const result = await pool.query("SELECT * FROM complaints ORDER BY id DESC");
    const rows = result.rows;

    // filter: public OR (private + owner matches) OR admin
    const filtered = rows.filter(r => {
      if (r.is_public) return true;
      if (viewerRole === 'Admin') return true;
      if (viewerFlat && String(r.flatno || '').toLowerCase() === String(viewerFlat).toLowerCase()) return true;
      return false;
    });
    res.json(filtered);
  } catch (err) {
    console.error("Error fetching complaints:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST new complaint
app.post("/api/complaints", async (req, res) => {
  const { flatNo, ownerName, body, is_public = true, status = 'open', admin_comments = '', created_at } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO complaints (flatno, ownername, body, is_public, status, admin_comments, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [flatNo, ownerName, body, is_public, status, admin_comments, created_at || new Date().toISOString()]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error creating complaint:", err);
    res.status(500).json({ error: err.message });
  }
});

// PUT update complaint (admin actions or owner update)
app.put("/api/complaints/:id", async (req, res) => {
  const id = req.params.id;
  const { status, admin_comments } = req.body;
  try {
    // update only provided fields
    const updates = [];
    const vals = [];
    let idx = 1;
    if (status !== undefined) {
      updates.push(`status = $${idx++}`);
      vals.push(status);
    }
    if (admin_comments !== undefined) {
      updates.push(`admin_comments = $${idx++}`);
      vals.push(admin_comments);
    }
    if (updates.length === 0) return res.status(400).json({ error: "Nothing to update" });
    vals.push(id);
    const q = `UPDATE complaints SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`;
    const result = await pool.query(q, vals);
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error updating complaint:", err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE complaint (admin)
app.delete("/api/complaints/:id", async (req, res) => {
  const id = req.params.id;
  try {
    await pool.query("DELETE FROM complaints WHERE id = $1", [id]);
    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting complaint:", err);
    res.status(500).json({ error: err.message });
  }
});
// ===== Start Server =====
app.listen(PORT, () =>
  console.log(`✅ Server running on port ${PORT}`)
);





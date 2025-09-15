const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");
const pool = require("./db");
require('./scheduler'); // ensures scheduler runs when server starts

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Nodemailer transporter setup
let transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER || "ashutoshakd123@gmail.com",
    pass: process.env.EMAIL_PASS || "effv jssg wdel lzvp"
  }
});

// ===== Send OTP Endpoint =====
app.post("/api/send-otp", async (req, res) => {
  const { flatNo } = req.body;
  if (!flatNo) {
    return res.status(400).json({ error: "flatNo is required" });
  }

  try {
    // Generate 5-digit OTP
    const otp = Math.floor(10000 + Math.random() * 90000).toString();

    // Set expiry 5 minutes from now
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    // Store OTP in DB
    await pool.query(
      "INSERT INTO otps (flatNo, otp, expires_at) VALUES ($1, $2, $3)",
      [flatNo, otp, expiresAt]
    );

    // Get owner's email
    const ownerResult = await pool.query("SELECT email FROM owners WHERE flatNo = $1", [flatNo]);
    if (ownerResult.rows.length === 0) {
      return res.status(404).json({ error: "Owner not found" });
    }
    const email = ownerResult.rows[0].email;
    if (!email) {
      return res.status(400).json({ error: "Owner email not found" });
    }

    // Send OTP email
    let info = await transporter.sendMail({
      from: '"Mangla Landmark" <no-reply@mangla.com>',
      to: email,
      subject: "Your OTP for Mangla Landmark Society Portal",
      text: `Your OTP is ${otp}. It expires in 5 minutes.`,
      html: `<p>Your OTP is <b>${otp}</b>. It expires in 5 minutes.</p>`
    });

    console.log("OTP sent: %s", info.messageId);

    res.json({ success: true, message: "OTP sent to email" });
  } catch (err) {
    console.error("Error sending OTP:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ===== Verify OTP Endpoint =====
app.post("/api/verify-otp", async (req, res) => {
  const { flatNo, otp } = req.body;
  if (!flatNo || !otp) {
    return res.status(400).json({ error: "flatNo and otp are required" });
  }

  try {
    // Check OTP validity and expiry
    const result = await pool.query(
      "SELECT * FROM otps WHERE flatNo = $1 AND otp = $2 AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1",
      [flatNo, otp]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: "Invalid or expired OTP" });
    }

    // Optionally, delete used OTPs for this flatNo
    await pool.query("DELETE FROM otps WHERE flatNo = $1", [flatNo]);

    res.json({ success: true, message: "OTP verified" });
  } catch (err) {
    console.error("Error verifying OTP:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

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

// ===== Start Server =====
app.listen(PORT, () =>
  console.log(`✅ Server running on port ${PORT}`)
);

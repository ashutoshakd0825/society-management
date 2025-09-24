const express = require("express");
const cors = require("cors");
const pool = require("./db");
require("./scheduler"); // ensures scheduler runs when server starts

const resend = require("./resendClient");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// ==================== Root Endpoint ====================
app.get("/api", (req, res) => {
  res.json({
    success: true,
    message: "🚀 Society Management API is live",
    endpoints: {
      sendOtp: "/api/send-otp",
      verifyOtp: "/api/verify-otp",
      test: "/api/test",
      balance: "/api/balance?month=&year=",
      settings: "/api/settings",
      owners: "/api/owners",
      expenses: "/api/expenses",
      receipts: "/api/receipts",
      announcements: "/api/announcements",
    },
  });
});

// ==================== OTP Endpoints ====================
// Send OTP
app.post("/api/send-otp", async (req, res) => {
  const { flatNo } = req.body;
  if (!flatNo) return res.status(400).json({ error: "flatNo is required" });

  try {
    const otp = Math.floor(10000 + Math.random() * 90000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await pool.query(
      "INSERT INTO otps (flatNo, otp, expires_at) VALUES ($1, $2, $3)",
      [flatNo, otp, expiresAt]
    );

    const ownerResult = await pool.query(
      "SELECT email FROM owners WHERE flatNo = $1",
      [flatNo]
    );
    if (ownerResult.rows.length === 0)
      return res.status(404).json({ error: "Owner not found" });

    const email = ownerResult.rows[0].email;
    if (!email) return res.status(400).json({ error: "Owner email not found" });

    await resend.emails.send({
      from: 'Mangla <no-reply@mangla.com>',
      to: email,
      subject: 'Your OTP for Mangla Landmark Society Portal',
      html: `<p>Your OTP is <b>${otp}</b>. It expires in 5 minutes.</p>`,
    });

    console.log("✅ OTP sent via Resend to:", email);
    res.json({ success: true, message: "OTP sent to email" });
  } catch (err) {
    console.error("Error sending OTP:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Verify OTP
app.post("/api/verify-otp", async (req, res) => {
  const { flatNo, otp } = req.body;
  if (!flatNo || !otp)
    return res.status(400).json({ error: "flatNo and otp are required" });

  try {
    const result = await pool.query(
      "SELECT * FROM otps WHERE flatNo = $1 AND otp = $2 AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1",
      [flatNo, otp]
    );

    if (result.rows.length === 0)
      return res.status(400).json({ error: "Invalid or expired OTP" });

    await pool.query("DELETE FROM otps WHERE flatNo = $1", [flatNo]);

    res.json({ success: true, message: "OTP verified" });
  } catch (err) {
    console.error("Error verifying OTP:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ==================== Other APIs ====================

// Test API
app.get("/api/test", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json({ success: true, time: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Balance Summary
app.get("/api/balance", async (req, res) => {
  const { month, year } = req.query;
  try {
    const [receipts, expenses, settings] = await Promise.all([
      pool.query("SELECT amount, date FROM receipts"),
      pool.query("SELECT amount, date FROM expenses"),
      pool.query(
        "SELECT value FROM settings WHERE setting_key = 'initial_balance'"
      ),
    ]);

    const filterByMonthYear = (rows) =>
      rows.filter((row) => {
        const d = new Date(row.date);
        return (
          (!month || d.getMonth() + 1 == month) &&
          (!year || d.getFullYear() == year)
        );
      });

    const totalCollection = filterByMonthYear(receipts.rows).reduce(
      (sum, r) => sum + Number(r.amount || 0),
      0
    );
    const totalExpenses = filterByMonthYear(expenses.rows).reduce(
      (sum, e) => sum + Number(e.amount || 0),
      0
    );
    const initialBalance = Number(settings.rows[0]?.value || 0);
    const balance = initialBalance + totalCollection - totalExpenses;

    res.json({ initialBalance, totalCollection, totalExpenses, balance });
  } catch (err) {
    console.error("❌ Error in balance API:", err);
    res.status(500).json({ error: err.message });
  }
});

// Settings
app.get("/api/settings/:key", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT value FROM settings WHERE setting_key = $1",
      [req.params.key]
    );
    if (result.rows.length > 0) {
      res.json({ setting_key: req.params.key, value: result.rows[0].value });
    } else {
      res.status(404).json({ error: "Setting not found" });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/settings", async (req, res) => {
  const { setting_key, value } = req.body;
  try {
    const result = await pool.query(
      `
      INSERT INTO settings (setting_key, value)
      VALUES ($1, $2)
      ON CONFLICT (setting_key)
      DO UPDATE SET value = EXCLUDED.value
      RETURNING *;
    `,
      [setting_key, value]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== CRUD for owners, expenses, receipts, announcements ====================
const validTables = ["owners", "expenses", "receipts", "announcements"];

app.get("/api/:type", async (req, res) => {
  const type = req.params.type;
  if (!validTables.includes(type))
    return res.status(400).json({ error: "Invalid table" });

  try {
    const result = await pool.query(`SELECT * FROM ${type} ORDER BY id DESC`);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/:type", async (req, res) => {
  const type = req.params.type;
  if (!validTables.includes(type))
    return res.status(400).json({ error: "Invalid table" });

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
        req.body.email,
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
        req.body.amount,
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
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/:type/:id", async (req, res) => {
  const type = req.params.type;
  if (!validTables.includes(type))
    return res.status(400).json({ error: "Invalid table" });

  try {
    await pool.query(`DELETE FROM ${type} WHERE id=$1`, [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== Start Server ====================
app.listen(PORT, () =>
  console.log(`✅ Server running on port ${PORT}`)
);

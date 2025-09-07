require('dotenv').config();
const cron = require("node-cron");
const fs = require("fs");
const path = require("path");
const nodemailer = require("nodemailer");
const { Pool } = require("pg");
const PDFDocument = require("pdfkit");

// PostgreSQL pool setup
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Email transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Ensure temp directory exists
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir);
}

// Generate styled PDF using PDFKit (no Puppeteer)
async function generateStyledPDF(row, pdfPath) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40 });
    const stream = fs.createWriteStream(pdfPath);
    doc.pipe(stream);

    const society = {
      name: "Mangla Landmark Society",
      address: "Plot No 7, Karol Bagh Rd, Kalyan Sampat Orchid, Bharwsala, Indore, MP - 453555"
    };

    doc.fontSize(20).text(society.name, { align: 'center' });
    doc.fontSize(10).text(society.address, { align: 'center' });
    doc.moveDown().fontSize(14).text("Maintenance Receipt", { align: 'center' });
    doc.moveDown();

    doc.fontSize(12).text(`Receipt ID: ${row.receiptid}`);
    doc.text(`Date: ${row.date || new Date().toLocaleDateString()}`);
    doc.text(`Flat No: ${row.flatno}`);
    doc.text(`Owner: ${row.name}`);
    doc.text(`Month: ${row.month}`);
    doc.text(`Mode: ${row.mode}`);
    doc.text(`Txn / Ref: ${row.txnid}`);
    doc.text(`Amount: ₹${row.amount}`);
    doc.moveDown();
    doc.fontSize(12).text("Received with thanks towards monthly maintenance.", {
      align: "center",
      border: "dashed"
    });
    doc.moveDown();
    doc.fontSize(10).fillColor('gray').text("This is a system generated receipt. No signature required.", {
      align: 'center'
    });

    doc.end();
    stream.on("finish", resolve);
    stream.on("error", reject);
  });
}

// Send monthly receipts
async function sendMonthlyReceipts() {
  console.log(`[${new Date().toISOString()}] [CRON] Generating monthly receipts...`);
  const month = new Date().toISOString().slice(0, 7); // "YYYY-MM"

  try {
    const res = await pool.query(
      `SELECT r.*, o.email 
       FROM receipts r 
       JOIN owners o ON r.flatno = o.flatno 
       WHERE TO_CHAR(TO_DATE(r.month, 'Mon-YY'), 'YYYY-MM') = $1 
         AND o.email IS NOT NULL`,
      [month]
    );

    for (let row of res.rows) {
      const pdfPath = path.join(tempDir, `receipt_${row.flatno}_${month}.pdf`);
      await generateStyledPDF(row, pdfPath);

      try {
        const info = await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: row.email,
          subject: `Maintenance Receipt — ${row.month}`,
          text: `Dear ${row.name},\n\nPlease find your maintenance receipt attached.\n\nThank you.`,
          attachments: [{ filename: `receipt_${row.flatno}_${month}.pdf`, path: pdfPath }],
        });
        console.log(`✅ Email sent to ${row.email}: ${info.messageId}`);
      } catch (emailErr) {
        console.error(`❌ Failed to send email to ${row.email}:`, emailErr);
      }

      fs.unlinkSync(pdfPath); // Delete PDF after sending
    }
  } catch (err) {
    console.error(`❌ Error in sendMonthlyReceipts:`, err);
  }
}

// Schedule: Every 1st of the month at 00:01 AM IST
//cron.schedule("1 0 1 * *", sendMonthlyReceipts, { timezone: "Asia/Kolkata" });

// Optional: For testing immediately
// sendMonthlyReceipts();

cron.schedule("* * * * *", sendMonthlyReceipts, { timezone: "Asia/Kolkata" });

// For testing manually:
// sendMonthlyReceipts();

// Schedule the job to run at 00:00 every month (1st day of every month at midnight IST)
//cron.schedule('0 0 1 * *', sendMonthlyReceipts, { timezone: "Asia/Kolkata" });

// For testing, you can uncomment this line to run immediately:
// sendMonthlyReceipts();

//cron.schedule("20 14 7 9 *", sendMonthlyReceipts, { timezone: "Asia/Kolkata" });
//cron.schedule("0 9 15 * *", sendMonthlyReceipts, { timezone: "Asia/Kolkata" });

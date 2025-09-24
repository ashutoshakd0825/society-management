
require('dotenv').config();
const cron = require("node-cron");
const fs = require("fs");
const path = require("path");
const { Resend } = require("resend");
const { Pool } = require("pg");
const html_to_pdf = require("html-pdf-node"); // ✅ Replaced puppeteer

const pool = require("./db");



// Email transporter using Resend
const resend = new Resend(process.env.RESEND_API_KEY);

// Ensure temp directory exists
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir);
}

// ✅ Generate styled PDF using html-pdf-node
async function generateStyledPDF(row, pdfPath) {
  const society = {
    name: "Mangla Landmark Society",
    address: "Plot No 7, Karol Bagh Rd, Kalyan Sampat Orchid, Bharwsala, Indore, MP - 453555"
  };

  const html = `
    <html>
      <head>
        <title>Receipt ${row.receiptid}</title>
        <style>
          body {
            font-family: 'Inter', Arial, sans-serif;
            background: #f9fafb;
            padding: 20px;
          }
          .receipt-box {
            max-width: 750px;
            margin: auto;
            padding: 20px;
            border: 1px solid #d1d5db;
            border-radius: 12px;
            background: #fff;
            color: #111827;
          }
          .header { text-align:center; margin-bottom:20px; }
          .header h2 { margin:0; font-size:24px; font-weight:700; }
          .header p { margin:4px 0; font-size:14px; color:#6b7280; }
          .header h3 { margin-top:8px; font-size:16px; font-weight:600; }

          .details {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px 40px;
            margin: 15px 0;
          }
          .details .label { font-weight:600; }
          .details .row { font-size:14px; }

          .box-msg {
            border:1px dashed #94a3b8;
            padding:8px;
            margin-top:12px;
            border-radius:8px;
            font-size:14px;
            text-align:center;
          }
          .footer {
            margin-top:14px;
            text-align:center;
            font-size:12px;
            color:#6b7280;
          }
        </style>
      </head>
      <body>
        <div class="receipt-box">
          <div class="header">
            <h2>${society.name}</h2>
            <p>${society.address}</p>
            <h3>Maintenance Receipt</h3>
          </div>

          <div class="details">
            <div class="row"><span class="label">Receipt ID:</span> ${row.receiptid}</div>
            <div class="row"><span class="label">Date:</span> ${row.date || new Date().toLocaleDateString()}</div>

            <div class="row"><span class="label">Flat No:</span> ${row.flatno}</div>
            <div class="row"><span class="label">Owner:</span> ${row.name}</div>

            <div class="row"><span class="label">Month:</span> ${row.month}</div>
            <div class="row"><span class="label">Mode:</span> ${row.mode}</div>

            <div class="row"><span class="label">Txn / Ref:</span> ${row.txnid}</div>
            <div class="row"><span class="label">Amount:</span> ₹${row.amount}</div>
          </div>

          <div class="box-msg">Received with thanks towards monthly maintenance.</div>

          <div class="footer">
            This is a system generated receipt. No signature required.
          </div>
        </div>
      </body>
    </html>
  `;

  const file = { content: html };
  const options = {
    format: "A4",
    path: pdfPath,
    printBackground: true
  };

  await html_to_pdf.generatePdf(file, options);
}

// 📩 Send monthly receipts
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
        const { data, error } = await resend.emails.send({
          from: 'no-reply@manglalandmark.xyz',
          to: [row.email],
          subject: `Maintenance Receipt — ${row.month}`,
          html: `<p>Dear ${row.name},</p><p>Please find your maintenance receipt attached.</p><p>Thank you.</p>`,
          attachments: [{ filename: `receipt_${row.flatno}_${month}.pdf`, content: fs.readFileSync(pdfPath) }],
        });
        if (error) {
          console.error(`❌ Failed to send email to ${row.email}:`, error);
        } else {
          console.log(`✅ Email sent to ${row.email}: ${data.id}`);
        }
      } catch (emailErr) {
        console.error(`❌ Failed to send email to ${row.email}:`, emailErr);
      }

      fs.unlinkSync(pdfPath); // Delete PDF after sending
    }
  } catch (err) {
    console.error(`❌ Error in sendMonthlyReceipts:`, err);
  }
}

/*
// 🕓 Cron Schedule — Run every 1st of month at 00:01 IST
cron.schedule("1 0 1 * *", sendMonthlyReceipts, { timezone: "Asia/Kolkata" });

// ✅ Uncomment below to test manually
// sendMonthlyReceipts();

//cron.schedule("* * * * *", sendMonthlyReceipts, { timezone: "Asia/Kolkata" });

// For testing manually:
sendMonthlyReceipts();

// Schedule the job to run at 00:00 every month (1st day of every month at midnight IST)
//cron.schedule('0 0 1 * *', sendMonthlyReceipts, { timezone: "Asia/Kolkata" });

// For testing, you can uncomment this line to run immediately:
// sendMonthlyReceipts();

//cron.schedule("20 14 7 9 *", sendMonthlyReceipts, { timezone: "Asia/Kolkata" });
cron.schedule("0 9 15 * *", sendMonthlyReceipts, { timezone: "Asia/Kolkata" });
*/

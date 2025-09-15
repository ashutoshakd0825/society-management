// ===== Backend API URL =====
// API_URL is defined in config.js
// For production, update config.js with the production URL
// ===== Utility =====
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
const fmtINR = n => '₹' + (Number(n||0)).toLocaleString('en-IN');

// ===== API Helpers =====
async function readRemote(type) {
  const res = await fetch(`${API_URL}/${type}`);
  return res.json();
}

async function writeRemote(type, item) {
  await fetch(`${API_URL}/${type}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(item)
  });
}

async function deleteRemote(type, id) {
  await fetch(`${API_URL}/${type}/${id}`, { method: "DELETE" });
}

// ===== Basic State =====
const society = {
  name: "Mangla Landmark",
  address: "Plot No 7, Karol Bagh Rd, Kalyan Sampat Orchid, Bharwsala, Indore, MP - 453555"
};

function setRole(role) {
  localStorage.setItem("ml_role", role);
  $('#roleBadge').textContent = role || 'Guest';
  const isAdmin = role === 'Admin';
  $$('.admin-only').forEach(el => el.style.display = isAdmin ? '' : 'none');
  $('#loginBtn').classList.toggle('hidden', isAdmin);
  $('#logoutBtn').classList.toggle('hidden', !isAdmin);

  // Hide/show tabs based on role
  const ownersTab = document.querySelector('[data-tab="owners"]');
  const expensesTab = document.querySelector('[data-tab="expenses"]');
  const receiptsTab = document.querySelector('[data-tab="receipts"]');
  const announcementsTab = document.querySelector('[data-tab="announcements"]');

  if (role === 'Admin' || role === 'Owner') {
    ownersTab.style.display = '';
    expensesTab.style.display = '';
    receiptsTab.style.display = '';
    announcementsTab.style.display = '';
  } else {
    ownersTab.style.display = 'none';
    expensesTab.style.display = 'none';
    receiptsTab.style.display = 'none';
    announcementsTab.style.display = 'none';
  }
}

function getRole() {
  return localStorage.getItem("ml_role") || 'Guest';
}

function setOtpVerified(verified) {
  localStorage.setItem("ml_otp_verified", verified);
}

function getOtpVerified() {
  return localStorage.getItem("ml_otp_verified") === "true";
}

// ===== Backend API URL =====




// ===== Tabs =====

// New: Intercept tab clicks to enforce OTP authentication for Owners
$$('.tab').forEach(btn => {
  btn.addEventListener('click', async (e) => {
    if (CURRENT_USER.role === 'Owner' && !CURRENT_USER.otpVerified) {
      e.preventDefault();
      // Show OTP modal
      $('#otpModal').showModal();
      // Set flatNo in OTP modal input
      $('#otpFlatNo').value = CURRENT_USER.flatNo || '';
      // Reset OTP modal UI
      otpStep1.classList.remove('hidden');
      otpStep2.classList.add('hidden');
      otpMessage.textContent = '';
      otpCode.value = '';
      // Do not switch tab content until verified
      return;
    }
    // If verified or not Owner, proceed with tab switch
    $$('.tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.tab;
    $$('.tab-panel').forEach(p => p.classList.remove('active'));
    $('#' + tab).classList.add('active');
  });
});

// ================== Global User Object ==================
window.CURRENT_USER = {
  role: "Guest",   // Guest / Admin / Owner
  flatNo: "",      // only if Owner
  otpVerified: getOtpVerified()
};

// ================== Utility Functions ==================

// ================== Login / Logout ==================
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const loginModal = document.getElementById("loginModal");
const loginForm = document.getElementById("loginForm");
const roleBadge = document.getElementById("roleBadge");

// ---- Open login modal ----
loginBtn.addEventListener("click", () => {
  loginModal.showModal();
});

// ---- Handle login ----
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();

  // ---- Admin Login ----
  if (username.toLowerCase() === "admin" && password.toLowerCase() === "admin") {
    CURRENT_USER.role = "Admin";
    CURRENT_USER.flatNo = "";
    setRole("Admin");
    alert("✅ Logged in as Admin");
  }
  // ---- Owner Login (for demo, use flatNo as username and password) ----
  else if (username && password && username.toLowerCase() === password.toLowerCase()) {
    CURRENT_USER.role = "Owner";
    CURRENT_USER.flatNo = username.toUpperCase(); // e.g., A-101
    CURRENT_USER.otpVerified = false;
    setOtpVerified(false);
    // Fetch owner data to get name
    try {
      const owners = await readRemote("owners");
      const owner = owners.find(o => o.flatno === CURRENT_USER.flatNo);
      if (owner) {
        CURRENT_USER.name = owner.name;
      }
    } catch (error) {
      console.error("Error fetching owner data:", error);
    }
    setRole("Owner");
    alert(`✅ Logged in as Owner (${CURRENT_USER.flatNo})`);
  }
  // ---- Invalid ----
  else {
    alert("❌ Invalid credentials");
    return;
  }

  loginModal.close();
  loginBtn.classList.add("hidden");
  logoutBtn.classList.remove("hidden");

  // Refresh all data after login
  renderAll();

  // If Owner, reset OTP verification and show OTP modal
  if (CURRENT_USER.role === "Owner") {
    CURRENT_USER.otpVerified = false;
    $('#otpFlatNo').value = CURRENT_USER.flatNo;
    $('#otpModal').showModal();
  }
});

// ---- Logout ----
logoutBtn.addEventListener("click", () => {
  CURRENT_USER.role = "Guest";
  CURRENT_USER.flatNo = "";
  CURRENT_USER.otpVerified = false;
  setOtpVerified(false);
  setRole('Guest');
  alert("🚪 Logged out");

  // Refresh complaints after logout
  if (typeof renderComplaints === "function") {
    renderComplaints();
  }
});

// ================== OTP Modal ==================
const otpModal = document.getElementById("otpModal");
const otpStep1 = document.getElementById("otpStep1");
const otpStep2 = document.getElementById("otpStep2");
const otpFlatNo = document.getElementById("otpFlatNo");
const otpCode = document.getElementById("otpCode");
const sendOtpBtn = document.getElementById("sendOtpBtn");
const verifyOtpBtn = document.getElementById("verifyOtpBtn");
const resendOtpBtn = document.getElementById("resendOtpBtn");
const otpMessage = document.getElementById("otpMessage");

let otpCooldown = 0;
let otpTimer;

// ---- Send OTP ----
sendOtpBtn.addEventListener("click", async () => {
  const flatNo = otpFlatNo.value.trim().toUpperCase();
  if (!flatNo) {
    otpMessage.textContent = "Please enter your flat number.";
    otpMessage.style.color = "red";
    return;
  }

  try {
    const response = await fetch(`${API_URL}/send-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ flatNo })
    });
    const result = await response.json();

    if (response.ok) {
      otpMessage.textContent = "OTP sent to your registered contact.";
      otpMessage.style.color = "green";
      otpStep1.classList.add("hidden");
      otpStep2.classList.remove("hidden");
      startOtpCooldown();
    } else {
      otpMessage.textContent = result.message || "Failed to send OTP.";
      otpMessage.style.color = "red";
    }
  } catch (error) {
    otpMessage.textContent = "Error sending OTP. Please try again.";
    otpMessage.style.color = "red";
  }
});

// ---- Verify OTP ----
verifyOtpBtn.addEventListener("click", async () => {
  const flatNo = otpFlatNo.value.trim().toUpperCase();
  const code = otpCode.value.trim();

  if (!code) {
    otpMessage.textContent = "Please enter the OTP.";
    otpMessage.style.color = "red";
    return;
  }

  try {
    const response = await fetch(`${API_URL}/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ flatNo, otp: code })
    });
    const result = await response.json();

    if (response.ok) {
      CURRENT_USER.otpVerified = true;
      setOtpVerified(true);
      otpMessage.textContent = "OTP verified successfully!";
      otpMessage.style.color = "green";
      setTimeout(() => {
        otpModal.close();
        renderAll();
      }, 1000);
    } else {
      otpMessage.textContent = result.message || "Invalid OTP.";
      otpMessage.style.color = "red";
    }
  } catch (error) {
    otpMessage.textContent = "Error verifying OTP. Please try again.";
    otpMessage.style.color = "red";
  }
});

// ---- Resend OTP ----
resendOtpBtn.addEventListener("click", () => {
  if (otpCooldown > 0) return;
  sendOtpBtn.click();
});

// ---- OTP Cooldown Timer ----
function startOtpCooldown() {
  otpCooldown = 60;
  resendOtpBtn.disabled = true;
  resendOtpBtn.textContent = `Resend in ${otpCooldown}s`;

  otpTimer = setInterval(() => {
    otpCooldown--;
    resendOtpBtn.textContent = `Resend in ${otpCooldown}s`;

    if (otpCooldown <= 0) {
      clearInterval(otpTimer);
      resendOtpBtn.disabled = false;
      resendOtpBtn.textContent = "Resend OTP";
    }
  }, 1000);
}

// ---- Reset OTP Modal on Close ----
otpModal.addEventListener("close", () => {
  otpStep1.classList.remove("hidden");
  otpStep2.classList.add("hidden");
  otpFlatNo.value = "";
  otpCode.value = "";
  otpMessage.textContent = "";
  clearInterval(otpTimer);
  otpCooldown = 0;
  resendOtpBtn.disabled = false;
  resendOtpBtn.textContent = "Resend OTP";
});

// ================== Misc UI ==================

// Update footer year
document.getElementById("year").innerText = new Date().getFullYear();

// ===== Owners =====
async function renderOwners() {
  if (CURRENT_USER.role === "Guest") {
    const body = $('#ownerTable tbody');
    body.innerHTML = '<tr><td colspan="7" style="text-align:center; color: #888;">Please login and verify OTP to view owner details.</td></tr>';
    $('#statFlats').textContent = 'N/A';
    return;
  }
  if (CURRENT_USER.role === "Owner" && !CURRENT_USER.otpVerified) {
    $('#otpModal').showModal();
    return;
  }
  const q = $('#ownerSearch').value.trim().toLowerCase();
  const data = await readRemote("owners");
  const body = $('#ownerTable tbody');
  body.innerHTML = '';
  data
    .filter(o => !q || [o.flatno,o.name,o.contact].some(v=> String(v).toLowerCase().includes(q)))
    .forEach((o, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${o.flatno}</td>
        <td>${o.name}</td>
        <td>${o.contact}</td>
        <td>${o.email || ''}</td>
        <td>${o.sqft}</td>
        <td>${o.parking}</td>
        <td class="admin-only">
          <button class="btn btn-danger" data-del="${o.id}">Delete</button>
        </td>
      `;
      body.appendChild(tr);
    });
  const isAdmin = getRole()==='Admin';
  $$('#ownerTable .admin-only').forEach(el => el.style.display = isAdmin ? '' : 'none');
  $('#statFlats').textContent = data.length;

  body.querySelectorAll("[data-del]").forEach(btn => {
    btn.addEventListener("click", async () => {
      if(confirm('Delete this owner?')) {
        await deleteRemote("owners", btn.dataset.del);
        renderOwners();
      }
    });
  });
}

$('#ownerSearch').addEventListener('input', renderOwners);
$('#ownerForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const f = e.target;
  const item = {
    flatNo: f.flatNo.value.trim(),
    name: f.name.value.trim(),
    contact: f.contact.value.trim(),
    email: f.email.value.trim(),
    sqft: Number(f.sqft.value||0),
    parking: f.parking.value.trim()
  };
  await writeRemote("owners", item);
  f.reset();
  renderOwners();
});

// ===== Expenses =====
function monthOptions(sel) {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  sel.innerHTML = '<option value="">All Months</option>' + months.map((m,i)=>`<option value="${i+1}">${m}</option>`).join('');
}
function yearOptions(sel) {
  const now = new Date().getFullYear();
  let opts = '<option value="">All Years</option>';
  for(let y=now-4;y<=now+1;y++) opts += `<option value="${y}">${y}</option>`;
  sel.innerHTML = opts;
}
async function renderExpenses() {
  if (CURRENT_USER.role === "Guest") {
    const body = $('#expenseTable tbody');
    body.innerHTML = '<tr><td colspan="5" style="text-align:center; color: #888;">Please login to view expense details.</td></tr>';
    $('#totalSalary').textContent = 'N/A';
    $('#totalFuel').textContent = 'N/A';
    $('#totalMisc').textContent = 'N/A';
    $('#totalExpenses').textContent = 'N/A';
    $('#statExpenses').textContent = 'N/A';
    return;
  }
  const data = await readRemote("expenses");
  const m = Number($('#expenseMonth').value || 0);
  const y = Number($('#expenseYear').value || 0);
  const body = $('#expenseTable tbody');
  body.innerHTML = '';
  let sumSalary=0,sumFuel=0,sumMisc=0,sumAll=0;
  data
    .filter(e=> {
      const d = new Date(e.date);
      return (!m || (d.getMonth()+1)==m) && (!y || d.getFullYear()==y);
    })
    .sort((a,b)=> new Date(b.date)-new Date(a.date))
    .forEach((e)=> {
      sumAll += Number(e.amount||0);
      if(e.category==='Salary') sumSalary += Number(e.amount||0);
      if(e.category==='Fuel') sumFuel += Number(e.amount||0);
      if(e.category==='Miscellaneous') sumMisc += Number(e.amount||0);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${e.date}</td>
        <td>${e.category}</td>
        <td>${e.note||''}</td>
        <td>${fmtINR(e.amount)}</td>
        <td class="admin-only"><button class="action danger" data-del="${e.id}">Delete</button></td>`;
      body.appendChild(tr);
    });
  $('#totalSalary').textContent = fmtINR(sumSalary);
  $('#totalFuel').textContent = fmtINR(sumFuel);
  $('#totalMisc').textContent = fmtINR(sumMisc);
  $('#totalExpenses').textContent = fmtINR(sumAll);
  $('#statExpenses').textContent = fmtINR(sumAll);
  const isAdmin = getRole()==='Admin';
  $$('#expenseTable .admin-only').forEach(el => el.style.display = isAdmin ? '' : 'none');

  body.querySelectorAll("[data-del]").forEach(btn => {
    btn.addEventListener("click", async () => {
      if(confirm('Delete this expense?')) {
        await deleteRemote("expenses", btn.dataset.del);
        renderExpenses();
      }
    });
  });
}

$('#expenseMonth').addEventListener('change', renderExpenses);
$('#expenseYear').addEventListener('change', renderExpenses);
$('#expenseForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const f = e.target;
  const item = {
    category: f.category.value,
    amount: Number(f.amount.value||0),
    date: f.date.value,
    note: f.note.value.trim()
  };
  await writeRemote("expenses", item);
  f.reset();
  renderExpenses();
});

// ===== Receipts =====

// New function for global serial receipt ID
async function generateReceiptId() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const datePart = `${yyyy}${mm}${dd}`;

  const data = await readRemote("receipts");

  // find max serial so far
  let maxSerial = 0;
  data.forEach(r => {
    const id = r.receiptid || r.receiptId || "";
    const serial = id.slice(-3); // last 3 digits
    if (!isNaN(serial)) {
      maxSerial = Math.max(maxSerial, parseInt(serial, 10));
    }
  });

  const sn = String(maxSerial + 1).padStart(3, '0');
  return `RCPT-${datePart}${sn}`;
}

async function renderReceipts() {
  if (CURRENT_USER.role === "Guest") {
    const body = $('#receiptTable tbody');
    body.innerHTML = '<tr><td colspan="9" style="text-align:center; color: #888;">Please login to view receipt details.</td></tr>';
    $('#statReceipts').textContent = 'N/A';
    return;
  }
  const q = $('#receiptSearch').value.trim().toLowerCase();
  const data = await readRemote("receipts");
  const body = $('#receiptTable tbody');
  body.innerHTML = '';
  data
    .filter(r => !q || [r.flatno, r.name, r.txnid].some(v=> String(v).toLowerCase().includes(q)))
    .sort((a,b)=> new Date(b.date)-new Date(a.date))
    .forEach((r)=> {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${r.receiptid || r.receiptId}</td>
        <td>${r.date}</td>
        <td>${r.flatno || r.flatNo}</td>
        <td>${r.name}</td>
        <td>${r.month}</td>
        <td>${r.mode}</td>
        <td>${r.txnid || r.txnId}</td>
        <td>${fmtINR(r.amount)}</td>
        <td>
          <button class="action" data-print="${r.id}">Print</button> 
          <button class="action danger admin-only" data-del="${r.id}">Delete</button>
        </td>`;
      body.appendChild(tr);
    });
  $('#statReceipts').textContent = data.length;
  const isAdmin = getRole()==='Admin';
  $$('#receiptTable .admin-only').forEach(el => el.style.display = isAdmin ? '' : 'none');

  body.querySelectorAll("[data-print]").forEach(btn=>{
    btn.addEventListener("click", ()=> {
      const rec = data.find(x=>x.id==btn.dataset.print);
      openPrintReceipt(rec);
    });
  });
  body.querySelectorAll("[data-del]").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      if(confirm('Delete this receipt?')) {
        await deleteRemote("receipts", btn.dataset.del);
        renderReceipts();
      }
    });
  });
}

$('#receiptSearch').addEventListener('input', renderReceipts);
$('#receiptForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const f = e.target;
  const receiptId = await generateReceiptId();
  const item = {
    receiptId,
    date: new Date().toISOString().slice(0,10),
    flatNo: f.flatNo.value.trim(),
    name: f.name.value.trim(),
    month: f.month.value.trim(),
    mode: f.mode.value,
    txnId: f.txnId.value.trim(),
    amount: Number(f.amount.value||0)
  };
  await writeRemote("receipts", item);
  f.reset();
  renderReceipts();
});

function openPrintReceipt(r) {
  const win = window.open('', '_blank');
  const html = `
    <html>
      <head>
        <title>Receipt ${r.receiptid || r.receiptId}</title>
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
          button {
            margin-top:16px;
            padding:6px 12px;
            border-radius:8px;
            border:1px solid #d1d5db;
            background:#f9fafb;
            cursor:pointer;
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
            <div class="row"><span class="label">Receipt ID:</span> ${r.receiptid || r.receiptId}</div>
            <div class="row"><span class="label">Date:</span> ${r.date}</div>

            <div class="row"><span class="label">Flat No:</span> ${r.flatno || r.flatNo}</div>
            <div class="row"><span class="label">Owner:</span> ${r.name}</div>

            <div class="row"><span class="label">Month:</span> ${r.month}</div>
            <div class="row"><span class="label">Mode:</span> ${r.mode}</div>

            <div class="row"><span class="label">Txn / Ref:</span> ${r.txnid || r.txnId}</div>
            <div class="row"><span class="label">Amount:</span> ${fmtINR(r.amount)}</div>
          </div>

          <div class="box-msg">Received with thanks towards monthly maintenance.</div>

          <div class="footer">
            This is a system generated receipt. No signature required.
          </div>

          <button onclick="window.print()">Print / Save PDF</button>
        </div>
      </body>
    </html>
  `;
  win.document.write(html);
  win.document.close();
}

// ===== Announcements =====
async function renderAnnouncements() {
  if (CURRENT_USER.role === "Guest") {
    const box = $('#announceList');
    box.innerHTML = '<div style="text-align:center; color: #888; padding: 20px;">Please login to view announcements.</div>';
    return;
  }
  const data = (await readRemote("announcements")).sort((a,b)=> new Date(b.date)-new Date(a.date));
  const box = $('#announceList');
  box.innerHTML = '';
  data.forEach((a)=>{
    const div = document.createElement('div');
    div.className = 'announcement';
    div.innerHTML = `<strong>${a.title}</strong><div class="muted">${a.date}</div>`;
    if(getRole()==='Admin') {
      div.innerHTML += `<button class="action danger" data-del="${a.id}">Delete</button>`;
    }
    box.appendChild(div);
  });
  box.querySelectorAll("[data-del]").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      if(confirm("Delete this announcement?")) {
        await deleteRemote("announcements", btn.dataset.del);
        renderAnnouncements();
      }
    });
  });
}

$('#announceForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const f = e.target;
  const item = { title: f.title.value.trim(), date: f.date.value };
  await writeRemote("announcements", item);
  f.reset();
  renderAnnouncements();
});

// ===== Init =====
async function renderAll() {
  await renderOwners();
  await renderExpenses();
  await renderReceipts();
  await renderAnnouncements();
  if (typeof renderComplaints === "function") {
    await renderComplaints();
  }
}


(function init(){
  setRole(getRole());
  monthOptions($('#expenseMonth'));
  yearOptions($('#expenseYear'));
  $('#year').textContent = new Date().getFullYear();
  renderAll();

  // Generate main QR code
  const qrCanvas = document.createElement('canvas');
  $('#main-qr').appendChild(qrCanvas);
  QRCode.toCanvas(qrCanvas, window.location.href, {
    width: 150,
    height: 150,
    logo: {
      src: 'https://via.placeholder.com/30x30?text=🏢',
      width: 30,
      height: 30
    }
  });
})();

// ===== Backend API URL =====
const API_URL = "https://society-management-etd8.onrender.com/api"; 
// 👆 yahan apna Render backend ka URL daalo

// ===== Utility =====
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
const fmtINR = n => '₹' + (Number(n||0)).toLocaleString('en-IN');

function uid(prefix='R'){
  const t = Date.now().toString(36);
  const r = Math.floor(Math.random()*1e6).toString(36);
  return prefix + '-' + t + r;
}

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
}

function getRole() {
  return localStorage.getItem("ml_role") || 'Guest';
}

// ===== Tabs =====
$$('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    $$('.tab').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.tab;
    $$('.tab-panel').forEach(p=>p.classList.remove('active'));
    $('#' + tab).classList.add('active');
  });
});

// ===== Login Modal =====
const loginModal = $('#loginModal');
$('#loginBtn').addEventListener('click', ()=> loginModal.showModal());
$('#logoutBtn').addEventListener('click', ()=> setRole('Guest'));
$('#loginSubmit').addEventListener('click', (e)=>{
  e.preventDefault();
  const u = $('#username').value.trim();
  const p = $('#password').value.trim();
  if(u==='admin' && p==='admin') {
    setRole('Admin');
    loginModal.close();
  } else {
    alert('Invalid credentials');
  }
});

// ===== Owners =====
async function renderOwners() {
  const q = $('#ownerSearch').value.trim().toLowerCase();
  const data = await readRemote("owners");
  const body = $('#ownerTable tbody');
  body.innerHTML = '';
  data
    .filter(o => !q || [o.flatNo,o.name,o.contact].some(v=> String(v).toLowerCase().includes(q)))
    .forEach((o, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${o.flatno || o.flatNo}</td>
        <td>${o.name}</td>
        <td>${o.contact}</td>
        <td>${o.sqft}</td>
        <td>${o.parking}</td>
        <td class="admin-only">
          <div class="table-actions">
            <button class="action danger" data-del="${o.id}">Delete</button>
          </div>
        </td>`;
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
async function renderReceipts() {
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
  const item = {
    receiptId: uid('RCPT'),
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
    <html><head><title>Receipt ${r.receiptid || r.receiptId}</title></head>
    <body>
      <h2>${society.name}</h2>
      <div>${society.address}</div>
      <h3>Maintenance Receipt</h3>
      <p><b>Receipt ID:</b> ${r.receiptid || r.receiptId}</p>
      <p><b>Date:</b> ${r.date}</p>
      <p><b>Flat No:</b> ${r.flatno || r.flatNo}</p>
      <p><b>Owner:</b> ${r.name}</p>
      <p><b>Month:</b> ${r.month}</p>
      <p><b>Mode:</b> ${r.mode}</p>
      <p><b>Txn ID:</b> ${r.txnid || r.txnId}</p>
      <p><b>Amount:</b> ${fmtINR(r.amount)}</p>
      <button onclick="window.print()">Print</button>
    </body></html>`;
  win.document.write(html);
  win.document.close();
}

// ===== Announcements =====
async function renderAnnouncements() {
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
}

(function init(){
  setRole(getRole());
  monthOptions($('#expenseMonth'));
  yearOptions($('#expenseYear'));
  $('#year').textContent = new Date().getFullYear();
  renderAll();
})();



// complaints.js
// Requires: API_URL to be defined (in script.js) and helper fmtINR if needed.
// This file is standalone for the complaints feature.

const $c = sel => document.querySelector(sel);
const $$c = sel => Array.from(document.querySelectorAll(sel));

// Safe: if script.js provided $, $$, fmtINR these will still work. We use our small helpers above.

// ===== DOM refs =====
const complaintForm = $c('#complaintForm');
const flatInput = $c('#complaintFlat');
const ownerInput = $c('#complaintOwner');
const bodyInput = $c('#complaintBody');
const dateInput = $c('#complaintDate');
const publicCheckbox = $c('#complaintPublic');
const complaintsList = $c('#complaintsList');
const filterSelect = $c('#complaintFilter');
const refreshBtn = $c('#refreshComplaints');

// set current datetime in form
function setNowToDateField() {
  const iso = new Date().toISOString().slice(0,19).replace('T', ' ');
  if(dateInput) dateInput.value = iso;
}
setNowToDateField();

// ===== helpers =====
async function readRemote(type) {
  const res = await fetch(`${API_URL}/${type}`);
  return res.json();
}
async function writeRemote(type, item) {
  const res = await fetch(`${API_URL}/${type}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(item)
  });
  return res.json();
}
async function putRemote(path, body) {
  const res = await fetch(`${API_URL}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return res.json();
}


// ===== Fetch owners for autocomplete (flat -> ownerName) =====
let ownersCache = [];
async function loadOwners() {
  try {
    ownersCache = await readRemote('owners'); // returns array of owner objects
  } catch (err) {
    console.error("Failed to load owners", err);
    ownersCache = [];
  }
}
loadOwners();

// simple autocomplete: when flat input loses focus or typed, fill owner
flatInput?.addEventListener('change', () => {
  const v = flatInput.value.trim().toLowerCase();
  const found = ownersCache.find(o => String(o.flatNo||o.flatno||'').toLowerCase() === v);
  if(found) {
    ownerInput.value = found.name || '';
  }
});

// if user types full flat that matches, autofill
flatInput?.addEventListener('input', () => {
  const v = flatInput.value.trim().toLowerCase();
  if(!v) return;
  const found = ownersCache.find(o => String(o.flatNo||o.flatno||'').toLowerCase() === v);
  if(found) ownerInput.value = found.name || '';
});

// ===== Render complaints =====
async function renderComplaints() {
  try {
    // append viewer info so backend can filter private complaints (optional)
    // We send viewerFlat and viewerRole from local storage role if available
    const viewerRole = localStorage.getItem('ml_role') || 'Guest';
    const viewerFlat = $c('#complaintFlat')?.value || '';

    // pass as query params
    const q = new URLSearchParams({ viewerRole, viewerFlat });
    const res = await fetch(`${API_URL}/complaints?${q.toString()}`);
    if(!res.ok) throw new Error('Fetch complaints failed');
    const data = await res.json();

    // apply client-side filter (status etc)
    let filtered = data;
    const f = filterSelect?.value || 'all';
    if(f === 'open') filtered = data.filter(x=>x.status==='open');
    if(f === 'ack') filtered = data.filter(x=>x.status==='ack');
    if(f === 'closed') filtered = data.filter(x=>x.status==='closed');
    if(f === 'mine') {
      const viewerFlatLocal = document.querySelector('#complaintFlat')?.value || '';
      filtered = data.filter(x => (x.flatno||x.flatNo||'') === viewerFlatLocal);
    }
    if(f === 'public') filtered = data.filter(x => x.is_public);

    // Build HTML
    complaintsList.innerHTML = '';
    if(filtered.length === 0) {
      complaintsList.innerHTML = '<p class="muted">No complaints found.</p>';
      return;
    }

    filtered.sort((a,b)=> new Date(b.created_at) - new Date(a.created_at));
    filtered.forEach(c => {
      const card = document.createElement('div');
      card.className = 'complaint-card';
      card.style = "border:1px solid #e2e8f0; padding:12px; margin-bottom:10px; border-radius:8px; background:#fff;";
      const isAdmin = localStorage.getItem('ml_role') === 'Admin';
      const viewerFlatLocal = document.querySelector('#complaintFlat')?.value || '';

      // Title
      card.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <strong>${c.flatno || c.flatNo} - ${c.ownerName || c.name}</strong>
            <span style="color:#6b7280; font-size:13px; margin-left:8px">${new Date(c.created_at).toLocaleString()}</span>
            ${c.is_public ? '<span style="margin-left:10px;padding:3px 6px;border-radius:6px;background:#e6fffa;color:#064e3b;font-size:12px">Public</span>' : '<span style="margin-left:10px;padding:3px 6px;border-radius:6px;background:#fff1f2;color:#7f1d1d;font-size:12px">Private</span>'}
          </div>
          <div>
            <small style="color:#475569">Status: <strong>${c.status}</strong></small>
          </div>
        </div>
        <div style="margin-top:8px; white-space:pre-wrap;">${escapeHtml(c.body)}</div>
        <div style="margin-top:8px; font-size:13px; color:#374151">
          <strong>Admin Comments:</strong> <span>${escapeHtml(c.admin_comments || '')}</span>
        </div>
        <div style="margin-top:10px; display:flex; gap:8px; align-items:center">
      `;

      // action buttons
      const actions = document.createElement('div');

      // If admin -> show Ack/Close/Comment/Delete
      if(isAdmin) {
        const ackBtn = createBtn('Ack', async () => {
          await updateComplaint(c.id, { status: 'ack' });
          renderComplaints();
        });
        const closeBtn = createBtn('Close', async () => {
          await updateComplaint(c.id, { status: 'closed' });
          renderComplaints();
        });
        const commentBtn = createBtn('Add Comment', async () => {
          const comment = prompt('Enter admin comment / notes:');
          if(comment !== null) {
            await updateComplaint(c.id, { admin_comments: comment });
            renderComplaints();
          }
        });
        const delBtn = createBtn('Delete', async () => {
          if(confirm('Delete this complaint?')) {
            await deleteRemote(`/complaints/${c.id}`);
            renderComplaints();
          }
        }, 'danger');
        actions.append(ackBtn, closeBtn, commentBtn, delBtn);
      } else {
        // If owner who raised it -> allow them to close? We'll allow to mark closed (optional)
        const viewerFlatValue = (document.querySelector('#complaintFlat')?.value || '').toString();
        if(viewerFlatValue && (String(c.flatno||c.flatNo) === viewerFlatValue)) {
          const closeBtn = createBtn('Close (by owner)', async () => {
            await updateComplaint(c.id, { status: 'closed' });
            renderComplaints();
          });
          actions.append(closeBtn);
        }
      }

      card.appendChild(actions);
      complaintsList.appendChild(card);
    });

  } catch (err) {
    console.error("Failed render complaints", err);
    complaintsList.innerHTML = '<p class="muted">Failed to load complaints.</p>';
  }
}

function createBtn(label, onClick, kind='primary') {
  const b = document.createElement('button');
  b.className = kind === 'danger' ? 'btn btn-danger' : 'btn';
  b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}

function escapeHtml(str='') {
  return String(str)
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'",'&#039;');
}

// update complaint (PUT)
async function updateComplaint(id, patch) {
  // backend PUT endpoint: /api/complaints/:id
  await fetch(`${API_URL}/complaints/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch)
  });
}

// ===== Submit new complaint =====
complaintForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const flatNo = flatInput.value.trim();
  const ownerName = ownerInput.value.trim();
  const body = bodyInput.value.trim();
  const is_public = !!publicCheckbox.checked;
  if(!flatNo || !ownerName || !body) {
    alert('Please fill flat, owner name and complaint body.');
    return;
  }
  // created_at auto
  const created_at = new Date().toISOString();

  const payload = {
    flatNo,
    ownerName,
    body,
    is_public,
    status: 'open',
    created_at
  };

  try {
    await writeRemote('complaints', payload); // POST /api/complaints
    complaintForm.reset();
    setNowToDateField();
    renderComplaints();
    alert('✅ Complaint submitted');
  } catch (err) {
    console.error('Failed submit', err);
    alert('Failed to submit complaint');
  }
});

// ===== Events =====
refreshBtn?.addEventListener('click', renderComplaints);
filterSelect?.addEventListener('change', renderComplaints);

// init
(function initComplaints(){
  populateMonthYearSelectorsIfExists();
  setNowToDateField();
  renderComplaints();
})();

// helper to populate month/year selectors only if feature uses it
function populateMonthYearSelectorsIfExists() {
  // no-op here; kept for parity with other code
}

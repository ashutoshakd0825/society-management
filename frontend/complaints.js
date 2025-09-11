// ================= Complaints Module =================

// ---- Backend API URL ----
//const API_URL = "https://society-management-etd8.onrender.com/api";

// ---- Auto-fill current date/time ----
function setComplaintDateTime() {
  const dtInput = document.querySelector('#complaintDate');
  if (dtInput) {
    const now = new Date();
    dtInput.value = now.toISOString().slice(0, 19).replace("T", " ");
  }
}
setComplaintDateTime();

// ---- Add new complaint ----
document.querySelector('#complaintForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const flatNo = document.querySelector('#complaintFlat')?.value?.trim();
  const ownerName = document.querySelector('#complaintOwner')?.value?.trim();
  const body = document.querySelector('#complaintBody')?.value?.trim();
  const is_public = document.querySelector('#complaintPublic')?.checked;
  const created_at = document.querySelector('#complaintDate')?.value;

  if (!flatNo || !ownerName || !body) {
    alert("⚠️ Please fill all fields.");
    return;
  }

  try {
    const res = await fetch(`${API_URL}/complaints`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        flatNo,
        ownerName,
        body,
        is_public,
        created_at,
        status: "open"
      })
    });

    if (!res.ok) throw new Error("Failed to submit complaint");
    alert("✅ Complaint submitted!");
    document.querySelector('#complaintForm').reset();
    setComplaintDateTime(); // reset new datetime
    renderComplaints();
  } catch (err) {
    console.error("❌ Complaint submit failed:", err);
    alert("⚠️ Failed to submit complaint.");
  }
});

// ---- Render complaints list ----
async function renderComplaints() {
  const container = document.querySelector('#complaintsList');
  if (!container) return;

  try {
    const res = await fetch(`${API_URL}/complaints?viewerRole=${CURRENT_USER.role}`);
    if (!res.ok) throw new Error("API call failed");

    let complaints = await res.json();

    // ---- Apply filters ----
    const filter = document.querySelector('#complaintFilter')?.value;
    if (filter === "mine") {
      complaints = complaints.filter(c => (c.flatno || c.flatNo) === CURRENT_USER.flatNo);
    } else if (filter === "public") {
      complaints = complaints.filter(c => c.is_public);
    } else if (filter === "open") {
      complaints = complaints.filter(c => c.status === "open");
    } else if (filter === "ack") {
      complaints = complaints.filter(c => c.status === "ongoing");
    } else if (filter === "closed") {
      complaints = complaints.filter(c => c.status === "closed");
    }

    if (!complaints.length) {
      container.innerHTML = `<p>No complaints found.</p>`;
      return;
    }

    container.innerHTML = `
      <table class="complaints-table">
        <thead>
          <tr>
            <th>Flat</th>
            <th>Date</th>
            <th>Name</th>
            <th>Complaint</th>
            <th>Status</th>
            <th>Admin Comment</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${complaints.map(c => {
            const id = c.id;
            const flat = c.flatno || c.flatNo || "";
            const name = c.ownername || c.ownerName || "";
            const date = new Date(c.created_at).toLocaleString();
            const body = c.body || "";
            const status = c.status || "open";
            const admin_comments = c.admin_comments || "";
            const isAdmin = CURRENT_USER.role === "Admin";

            return `
              <tr>
                <td>${flat}</td>
                <td>${date}</td>
                <td>${name}</td>
                <td>${body}</td>
                <td>
                  ${isAdmin ? `
                    <select data-status="${id}">
                      <option value="open" ${status === "open" ? "selected" : ""}>Open</option>
                      <option value="ongoing" ${status === "ongoing" ? "selected" : ""}>Ongoing</option>
                      <option value="closed" ${status === "closed" ? "selected" : ""}>Closed</option>
                      <option value="not_possible" ${status === "not_possible" ? "selected" : ""}>Not Possible</option>
                    </select>
                  ` : status}
                </td>
                <td>
                  ${isAdmin ? `<input type="text" data-comment="${id}" value="${admin_comments}" />` : admin_comments}
                </td>
                <td>
                  ${isAdmin ? `
                    <button data-save="${id}">Save</button>
                    <button data-del="${id}">Delete</button>
                  ` : ""}
                </td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    `;

    // ---- Save action ----
    container.querySelectorAll("[data-save]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.save;
        const status = container.querySelector(`[data-status="${id}"]`)?.value;
        const admin_comments = container.querySelector(`[data-comment="${id}"]`)?.value;

        try {
          const res = await fetch(`${API_URL}/complaints/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status, admin_comments })
          });
          if (!res.ok) throw new Error("Update failed");
          alert("✅ Complaint updated!");
          renderComplaints();
        } catch (err) {
          console.error("❌ Update failed:", err);
          alert("⚠️ Failed to update complaint.");
        }
      });
    });

    // ---- Delete action ----
    container.querySelectorAll("[data-del]").forEach(btn => {
      btn.addEventListener("click", async () => {
        if (!confirm("Delete this complaint?")) return;
        try {
          const res = await fetch(`${API_URL}/complaints/${btn.dataset.del}`, {
            method: "DELETE"
          });
          if (!res.ok) throw new Error("Delete failed");
          alert("🗑️ Complaint deleted!");
          renderComplaints();
        } catch (err) {
          console.error("❌ Delete failed:", err);
          alert("⚠️ Failed to delete complaint.");
        }
      });
    });

  } catch (err) {
    console.error("❌ Failed to load complaints:", err);
    container.innerHTML = `<p>Failed to load complaints.</p>`;
  }
}

// ---- Event listeners for filters ----
document.querySelector('#complaintFilter')?.addEventListener('change', renderComplaints);
document.querySelector('#refreshComplaints')?.addEventListener('click', renderComplaints);

// ---- Initialize ----
renderComplaints();

// ================= Complaints Module =================

// ---- Backend API URL ----
const API_URL = "https://society-management-etd8.onrender.com/api";

// ---- Add new complaint ----
document.querySelector('#complaintForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const flatNo = document.querySelector('#complaintFlatNo')?.value?.trim();
  const ownerName = document.querySelector('#complaintOwnerName')?.value?.trim();
  const body = document.querySelector('#complaintBody')?.value?.trim();
  const is_public = document.querySelector('#complaintPublic')?.checked;

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
        is_public
      })
    });

    if (!res.ok) throw new Error("Failed to submit complaint");
    alert("✅ Complaint submitted!");
    document.querySelector('#complaintForm').reset();
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
    const res = await fetch(`${API_URL}/complaints?viewerRole=Admin`);
    if (!res.ok) throw new Error("API call failed");

    const complaints = await res.json();
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
          ${complaints.map(c => `
            <tr>
              <td>${c.flatno || c.flatNo || ""}</td>
              <td>${new Date(c.created_at).toLocaleString()}</td>
              <td>${c.ownername || c.ownerName || ""}</td>
              <td>${c.body}</td>
              <td>
                <select data-status="${c.id}">
                  <option value="open" ${c.status === "open" ? "selected" : ""}>Open</option>
                  <option value="ongoing" ${c.status === "ongoing" ? "selected" : ""}>Ongoing</option>
                  <option value="closed" ${c.status === "closed" ? "selected" : ""}>Closed</option>
                  <option value="not_possible" ${c.status === "not_possible" ? "selected" : ""}>Not Possible</option>
                </select>
              </td>
              <td>
                <input type="text" data-comment="${c.id}" value="${c.admin_comments || ""}" />
              </td>
              <td>
                <button data-save="${c.id}">Save</button>
                <button data-del="${c.id}">Delete</button>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;

    // ---- Attach actions ----
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

// ---- Initialize ----
renderComplaints();

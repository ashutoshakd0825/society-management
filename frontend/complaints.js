// ================= Complaints Module =================

// ---- Backend API URL ----
// Uncomment below if you're deploying, otherwise leave it as relative
// const API_URL = "https://society-management-etd8.onrender.com/api";

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
document.getElementById("complaintForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const flatNo = document.getElementById("complaintFlatNo").value.trim().toLowerCase(); // ✅ lowercase
  const ownerName = document.getElementById("complaintOwnerName").value.trim().toLowerCase(); // ✅ lowercase
  const body = document.getElementById("complaintBody").value.trim();
  const is_public = document.getElementById("complaintPublic").checked;
  const date = new Date().toISOString();

  const payload = {
    flatNo,
    ownerName,
    body,
    is_public,
    created_at: date,
  };

  try {
    const res = await fetch("/api/complaints", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (res.ok) {
      alert("✅ Complaint submitted");
      document.getElementById("complaintForm").reset();
      renderComplaints(); // reload list
    } else {
      alert("❌ Error: " + data.error);
    }
  } catch (err) {
    console.error("Error submitting complaint:", err);
    alert("❌ Failed to submit complaint");
  }
});

// ---- Render complaints list ----
async function renderComplaints() {
  const container = document.querySelector('#complaintsList');
  if (!container) return;

  try {
    const res = await fetch(`/api/complaints?viewerRole=${CURRENT_USER.role}&viewerFlat=${CURRENT_USER.flatNo.toLowerCase()}`);
    if (!res.ok) throw new Error("API call failed");

    let complaints = await res.json();

    // ---- Apply filters ----
    const filter = document.querySelector('#complaintFilter')?.value;
    if (filter === "mine") {
      complaints = complaints.filter(c =>
        (c.flatno || c.flatNo || '').toLowerCase() === CURRENT_USER.flatNo.toLowerCase()
      );
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
          const res = await fetch(`/api/complaints/${id}`, {
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
          const res = await fetch(`/api/complaints/${btn.dataset.del}`, {
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
    container.innerHTML = `<p>❌ Failed to load complaints.</p>`;
  }
}

// ---- Event listeners for filters ----
document.querySelector('#complaintFilter')?.addEventListener('change', renderComplaints);
document.querySelector('#refreshComplaints')?.addEventListener('click', renderComplaints);

// ---- Initialize ----
renderComplaints();

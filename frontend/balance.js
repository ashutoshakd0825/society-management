// ===== API URL (pointing to your Render backend) =====
//const API_URL = "https://society-management-etd8.onrender.com/api";

// ===== Utility for INR Formatting =====
const fmtINR = n => '₹' + (Number(n || 0)).toLocaleString('en-IN');

// ===== Render Balance Summary from backend =====
async function renderBalanceSummary() {
  const selectedMonth = document.querySelector('#dashboardMonth')?.value || "";
  const selectedYear = document.querySelector('#dashboardYear')?.value || "";

  try {
    const res = await fetch(`${API_URL}/balance?month=${selectedMonth}&year=${selectedYear}`);
    if (!res.ok) throw new Error("API call failed");

    const { totalCollection, totalExpenses, balance, initialBalance } = await res.json();

    // Update UI values
    document.querySelector('#totalCollection').textContent = fmtINR(totalCollection);
    document.querySelector('#totalExpenseDashboard').textContent = fmtINR(totalExpenses);
    document.querySelector('#balanceRemaining').textContent = fmtINR(balance);

    // Set initial balance field (Admin tools)
    const input = document.querySelector('#initialBalance');
    if (input) input.value = initialBalance;
  } catch (err) {
    console.error("❌ Failed to fetch balance:", err);
    alert("⚠️ Error loading balance summary. Please try again.");
  }
}

// ===== Save Initial Balance to DB =====
document.querySelector('#saveInitialBalance')?.addEventListener('click', async () => {
  const input = document.querySelector('#initialBalance');
  const val = Number(input?.value || 0);

  if (isNaN(val) || val < 0) {
    alert("⚠️ Please enter a valid non-negative number.");
    return;
  }

  try {
    const res = await fetch(`${API_URL}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'initial_balance', value: val })
    });

    if (!res.ok) throw new Error("API save failed");

    alert("✅ Initial balance saved!");
    renderBalanceSummary(); // Refresh after saving
  } catch (err) {
    console.error("❌ Error saving initial balance:", err);
    alert("⚠️ Error saving initial balance.");
  }
});

// ===== Attach Events =====
document.querySelector('#refreshDashboard')?.addEventListener('click', renderBalanceSummary);
document.querySelector('#dashboardMonth')?.addEventListener('change', renderBalanceSummary);
document.querySelector('#dashboardYear')?.addEventListener('change', renderBalanceSummary);

// ===== Auto-run on page load =====
renderBalanceSummary();

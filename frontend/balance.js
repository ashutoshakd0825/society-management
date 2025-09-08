// ===== API Helpers (reuse from script.js if not imported) =====
const API_URL = "https://society-management-etd8.onrender.com/api";
const fmtINR = n => '₹' + (Number(n || 0)).toLocaleString('en-IN');

// ===== Render Balance Summary =====
async function renderBalanceSummary() {
  const selectedMonth = document.querySelector('#dashboardMonth')?.value || "";
  const selectedYear = document.querySelector('#dashboardYear')?.value || "";

  try {
    const res = await fetch(`${API_URL}/balance?month=${selectedMonth}&year=${selectedYear}`);
    const { totalCollection, totalExpenses, balance, initialBalance } = await res.json();

    // Update DOM
    document.querySelector('#totalCollection').textContent = fmtINR(totalCollection);
    document.querySelector('#totalExpenseDashboard').textContent = fmtINR(totalExpenses);
    document.querySelector('#balanceRemaining').textContent = fmtINR(balance);

    // Set saved initial balance input
    if (document.querySelector('#initialBalance')) {
      document.querySelector('#initialBalance').value = initialBalance;
    }
  } catch (err) {
    console.error("❌ Failed to fetch balance:", err);
    alert("Error fetching balance data.");
  }
}

// ===== Save Initial Balance (optional feature) =====
document.querySelector('#saveInitialBalance')?.addEventListener('click', async () => {
  const val = document.querySelector('#initialBalance')?.value || "0";
  try {
    const res = await fetch(`${API_URL}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'initial_balance', value: val })
    });
    const data = await res.json();
    alert("✅ Initial balance saved!");
    renderBalanceSummary(); // Refresh
  } catch (err) {
    console.error("❌ Failed to save initial balance:", err);
    alert("Error saving initial balance.");
  }
});

// ===== Events =====
document.querySelector('#refreshDashboard')?.addEventListener('click', renderBalanceSummary);
document.querySelector('#dashboardMonth')?.addEventListener('change', renderBalanceSummary);
document.querySelector('#dashboardYear')?.addEventListener('change', renderBalanceSummary);

// Auto run on page load
renderBalanceSummary();


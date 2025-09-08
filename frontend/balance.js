const API_URL = "https://society-management-etd8.onrender.com/api";
const fmtINR = n => '₹' + (Number(n || 0)).toLocaleString('en-IN');

// ===== Render Balance Summary from backend =====
async function renderBalanceSummary() {
  const selectedMonth = document.querySelector('#dashboardMonth')?.value || "";
  const selectedYear = document.querySelector('#dashboardYear')?.value || "";

  try {
    const res = await fetch(`${API_URL}/balance?month=${selectedMonth}&year=${selectedYear}`);
    const { totalCollection, totalExpenses, balance, initialBalance } = await res.json();

    // Update UI
    document.querySelector('#totalCollection').textContent = fmtINR(totalCollection);
    document.querySelector('#totalExpenseDashboard').textContent = fmtINR(totalExpenses);
    document.querySelector('#balanceRemaining').textContent = fmtINR(balance);

    // Set the input field if it exists
    if (document.querySelector('#initialBalance')) {
      document.querySelector('#initialBalance').value = initialBalance;
    }
  } catch (err) {
    console.error("❌ Failed to fetch balance:", err);
    alert("Error loading balance summary. Please try again.");
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
    await fetch(`${API_URL}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'initial_balance', value: val })
    });

    alert("✅ Initial balance saved!");
    renderBalanceSummary(); // Refresh after saving
  } catch (err) {
    console.error("❌ Error saving initial balance:", err);
    alert("Error saving initial balance.");
  }
});

// ===== Events =====
document.querySelector('#refreshDashboard')?.addEventListener('click', renderBalanceSummary);
document.querySelector('#dashboardMonth')?.addEventListener('change', renderBalanceSummary);
document.querySelector('#dashboardYear')?.addEventListener('change', renderBalanceSummary);

// Auto-run on page load
renderBalanceSummary();

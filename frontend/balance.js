// ===== Utility for INR Formatting =====
//const API_URL = "https://society-management-etd8.onrender.com/api"; 
//const fmtINR = n => '₹' + (Number(n || 0)).toLocaleString('en-IN');

// ===== Populate Month & Year Dropdowns =====
function populateMonthYearSelectors() {
  const monthSel = document.querySelector('#dashboardMonth');
  const yearSel = document.querySelector('#dashboardYear');
  if (!monthSel || !yearSel) return;

  // Months
  const months = [
    "01 - Jan", "02 - Feb", "03 - Mar", "04 - Apr",
    "05 - May", "06 - Jun", "07 - Jul", "08 - Aug",
    "09 - Sep", "10 - Oct", "11 - Nov", "12 - Dec"
  ];
  monthSel.innerHTML = `<option value="">All</option>`;
  months.forEach((m, i) => {
    monthSel.innerHTML += `<option value="${i + 1}">${m}</option>`;
  });

  // Years (from 2023 → next year)
  const currentYear = new Date().getFullYear();
  yearSel.innerHTML = `<option value="">All</option>`;
  for (let y = 2023; y <= currentYear + 1; y++) {
    yearSel.innerHTML += `<option value="${y}">${y}</option>`;
  }

  // Default selection
  monthSel.value = (new Date().getMonth() + 1).toString();
  yearSel.value = currentYear.toString();
}

// ===== Render Balance Summary from backend =====
async function renderBalanceSummary() {
  const monthSel = document.querySelector('#dashboardMonth');
  const yearSel = document.querySelector('#dashboardYear');

  const selectedMonth = monthSel?.value || "";
  const selectedYear = yearSel?.value || "";

  try {
    const res = await fetch(`${API_URL}/balance?month=${selectedMonth}&year=${selectedYear}`);
    if (!res.ok) throw new Error("API call failed");

    const { totalCollection, totalExpenses, balance, initialBalance } = await res.json();

    // Update UI
    document.querySelector('#totalCollection').textContent = fmtINR(totalCollection);
    document.querySelector('#totalExpenseDashboard').textContent = fmtINR(totalExpenses);
    document.querySelector('#balanceRemaining').textContent = fmtINR(balance);

    // Initial balance input (Admin tools)
    const input = document.querySelector('#initialBalance');
    if (input) input.value = initialBalance;
  } catch (err) {
    console.error("❌ Failed to fetch balance:", err);
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
    renderBalanceSummary(); // Refresh
  } catch (err) {
    console.error("❌ Error saving initial balance:", err);
    alert("⚠️ Error saving initial balance.");
  }
});

// ===== Events =====
document.querySelector('#refreshDashboard')?.addEventListener('click', renderBalanceSummary);
document.querySelector('#dashboardMonth')?.addEventListener('change', renderBalanceSummary);
document.querySelector('#dashboardYear')?.addEventListener('change', renderBalanceSummary);

// ===== Initialize =====
populateMonthYearSelectors();
renderBalanceSummary();

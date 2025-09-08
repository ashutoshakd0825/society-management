// ===== API Helpers (reuse from script.js if not imported) =====
const API_URL = "https://society-management-etd8.onrender.com/api";
const fmtINR = n => '₹' + (Number(n||0)).toLocaleString('en-IN');

// Fetch wrapper
async function readRemote(type) {
  const res = await fetch(`${API_URL}/${type}`);
  return res.json();
}

// Initial Balance (from localStorage)
function getInitialBalance() {
  return Number(localStorage.getItem("ml_initial_balance") || 0);
}

// ===== Render Balance Summary =====
async function renderBalanceSummary() {
  const receipts = await readRemote("receipts");
  const expenses = await readRemote("expenses");

  const selectedMonth = Number(document.querySelector('#dashboardMonth').value || 0);
  const selectedYear = Number(document.querySelector('#dashboardYear').value || 0);

  // Filter receipts
  const filteredReceipts = receipts.filter(r => {
    const d = new Date(r.date);
    return (!selectedMonth || (d.getMonth()+1) === selectedMonth) &&
           (!selectedYear || d.getFullYear() === selectedYear);
  });

  // Filter expenses
  const filteredExpenses = expenses.filter(e => {
    const d = new Date(e.date);
    return (!selectedMonth || (d.getMonth()+1) === selectedMonth) &&
           (!selectedYear || d.getFullYear() === selectedYear);
  });

  const totalCollection = filteredReceipts.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);

  const initialBalance = getInitialBalance();
  const balance = initialBalance + totalCollection - totalExpenses;

  // Update DOM
  document.querySelector('#totalCollection').textContent = fmtINR(totalCollection);
  document.querySelector('#totalExpenseDashboard').textContent = fmtINR(totalExpenses);
  document.querySelector('#balanceRemaining').textContent = fmtINR(balance);

  // Set saved initial balance input
  if(document.querySelector('#initialBalance')) {
    document.querySelector('#initialBalance').value = initialBalance;
  }
}

// ===== Events =====
document.querySelector('#refreshDashboard')?.addEventListener('click', renderBalanceSummary);
document.querySelector('#dashboardMonth')?.addEventListener('change', renderBalanceSummary);
document.querySelector('#dashboardYear')?.addEventListener('change', renderBalanceSummary);

// Auto run on page load
renderBalanceSummary();

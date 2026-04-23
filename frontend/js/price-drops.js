import { apiGet, fmtGbp } from "./api-client.js";

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function init() {
  const status = document.getElementById("drops-status");
  const modeEl = document.getElementById("drops-mode");
  const tbody = document.getElementById("drops-rows");

  if (status) status.textContent = "Loading price data...";

  try {
    const payload = await apiGet("/api/price-drops?limit=100");
    const rows = payload.rows || [];

    if (modeEl) {
      modeEl.textContent = payload.mode === "snapshot_discount_vs_rrp"
        ? "Current discount vs RRP"
        : "Fallback mode (sets + RRP)";
    }

    if (tbody) {
      tbody.innerHTML = rows.map((row) => {
        const setNo = escapeHtml(row.set_number || "Unknown");
        const title = escapeHtml(row.title || "Untitled set");
        const nowPrice = fmtGbp(row.now_price ?? row.rrp_gbp);
        const rrpPrice = row.rrp_gbp == null ? "Unavailable" : fmtGbp(row.rrp_gbp);
        const vsRrp = row.vs_rrp_pct == null ? "Unavailable" : `${Number(row.vs_rrp_pct).toFixed(1)}%`;
        return `<tr><td><a href='/set-page?set=${encodeURIComponent(setNo)}'>${setNo} - ${title}</a></td><td>${nowPrice}</td><td>${rrpPrice}</td><td>${vsRrp}</td></tr>`;
      }).join("");
    }

    if (status) status.textContent = `${rows.length} row(s) loaded`;
  } catch (error) {
    if (status) status.textContent = `Error: ${error.message}`;
  }
}

init();

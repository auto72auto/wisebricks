import { apiGet, fmtInt, fmtYear, fmtGbp } from "./api-client.js";

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function fmtPct(value) {
  if (value === null || value === undefined || value === "") return "Click to check";
  const n = Number(value);
  if (!Number.isFinite(n)) return "Click to check";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

function fmtPriceOrCheck(value) {
  const price = fmtGbp(value);
  return price === "Unavailable" ? "Click to check" : price;
}

function fmtStock(value) {
  const map = {
    in_stock: "In stock",
    out_of_stock: "Out of stock",
    preorder: "Preorder",
    unknown: "Click to check",
  };
  return map[value] || "Click to check";
}

function renderRetailers(rows) {
  const tbody = document.getElementById("retailer-table-body");
  if (!tbody) return;

  const linkedRows = (rows || []).filter((row) => String(row.product_url || "").trim() !== "");
  if (!linkedRows.length) {
    tbody.innerHTML = "<tr><td colspan='5'>No retailer links available for this set yet.</td></tr>";
    return;
  }

  tbody.innerHTML = linkedRows
    .map((row) => {
      const retailer = row.retailer || row.retailer_key || "Retailer";
      const url = String(row.product_url || "").trim();
      return `<tr>
        <td>${retailer}</td>
        <td>${fmtPriceOrCheck(row.price_gbp)}</td>
        <td>${fmtPct(row.pct_vs_rrp)}</td>
        <td>${fmtStock(row.stock_state)}</td>
        <td><a href="${url}" target="_blank" rel="noopener noreferrer">Visit</a></td>
      </tr>`;
    })
    .join("");
}

async function init() {
  const params = new URLSearchParams(window.location.search);
  const setNumber = (params.get("set") || "75325").trim();

  setText("set-status", "Loading set data...");

  try {
    const payload = await apiGet(`/api/set/${encodeURIComponent(setNumber)}`);
    const set = payload.set;

    setText("set-badge", `Set ${set.set_number || setNumber}`);
    setText("set-title", set.title || "Untitled set");
    setText(
      "set-summary",
      `Set Number: ${set.set_number || "Unavailable"} | Release Year: ${fmtYear(set.release_year)} | Pieces: ${fmtInt(set.pieces)} | UK RRP: ${fmtGbp(set.rrp_gbp)}`
    );
    setText("meta-set-number", set.set_number || "Unavailable");
    setText("meta-release-year", fmtYear(set.release_year));
    setText("meta-pieces", fmtInt(set.pieces));
    setText("meta-theme", set.theme || "Unavailable");
    renderRetailers(payload.retailers);
    setText("set-status", "Live from database");
  } catch (error) {
    setText("set-status", `Error: ${error.message}`);
    renderRetailers([]);
  }
}

init();

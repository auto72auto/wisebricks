import { apiGet, fmtInt, fmtYear, fmtGbp } from "./api-client.js";

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

async function init() {
  const params = new URLSearchParams(window.location.search);
  const setNumber = (params.get("set") || "10316").trim();

  setText("set-status", "Loading set data...");

  try {
    const payload = await apiGet(`/api/set/${encodeURIComponent(setNumber)}`);
    const set = payload.set;

    setText("set-badge", `Set ${set.set_number || setNumber}`);
    setText("set-title", set.title || "Untitled set");
    setText("set-summary", `Set Number: ${set.set_number || "Unavailable"} | Release Year: ${fmtYear(set.release_year)} | Pieces: ${fmtInt(set.pieces)} | UK RRP: ${fmtGbp(set.rrp_gbp)}`);
    setText("meta-set-number", set.set_number || "Unavailable");
    setText("meta-release-year", fmtYear(set.release_year));
    setText("meta-pieces", fmtInt(set.pieces));
    setText("meta-theme", set.theme || "Unavailable");
    setText("set-status", "Live from database");
  } catch (error) {
    setText("set-status", `Error: ${error.message}`);
  }
}

init();

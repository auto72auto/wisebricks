import { apiGet, fmtInt, fmtYear } from "./api-client.js";

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function init() {
  const status = document.getElementById("theme-status");
  const tableBody = document.getElementById("theme-rows");

  if (status) status.textContent = "Loading themes...";

  try {
    const payload = await apiGet("/api/themes?limit=20");
    const themes = payload.themes || [];

    if (tableBody) {
      tableBody.innerHTML = themes.map((row) => {
        const theme = escapeHtml(row.theme || "Unknown");
        return `<tr><td>${theme}</td><td>${fmtInt(row.set_count)}</td><td>${fmtYear(row.latest_year)}</td><td>${fmtInt(row.avg_pieces)}</td></tr>`;
      }).join("");
    }

    if (status) status.textContent = `${themes.length} themes loaded`;
  } catch (error) {
    if (status) status.textContent = `Error: ${error.message}`;
  }
}

init();

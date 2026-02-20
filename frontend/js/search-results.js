import { apiGet, fmtInt, fmtYear } from "./api-client.js";

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeImageSetNumber(setNumber) {
  const raw = String(setNumber || "").trim();
  if (!raw) return "";
  const cleaned = raw.replace(/[^0-9A-Za-z_-]/g, "");
  const variantMatch = cleaned.match(/^([0-9]{3,8})-[0-9]+$/);
  return variantMatch ? variantMatch[1] : cleaned;
}

function renderResults(results) {
  const container = document.getElementById("results");
  if (!container) return;

  if (!results.length) {
    container.innerHTML = "<article class='card'><h3>No set found</h3><p class='muted'>Try a different set number or title.</p></article>";
    return;
  }

  container.innerHTML = results.map((set) => {
    const rawSetNo = String(set.set_number || "").trim();
    const safeSetNo = normalizeImageSetNumber(rawSetNo);
    const setNo = escapeHtml(rawSetNo || "Unknown");
    const title = escapeHtml(set.title || "Untitled set");
    const imageBlock = safeSetNo
      ? `<div class='set-card-media'><img class='set-card-image' data-box-image='true' loading='lazy' src='/set-images/${encodeURIComponent(safeSetNo)}/box.jpg' alt='Set ${setNo} in-box image' /></div>`
      : "";
    return `<article class='card set-card'><div class='set-card-row'><div class='set-card-text'><h3>${setNo} - ${title}</h3><p class='muted'>Pieces: ${fmtInt(set.pieces)} | Release year: ${fmtYear(set.release_year)}</p></div>${imageBlock}</div><a class='btn' href='/set/${encodeURIComponent(rawSetNo || setNo)}'>Open Set Page</a></article>`;
  }).join("");

  container.querySelectorAll("img[data-box-image='true']").forEach((img) => {
    img.addEventListener("error", () => {
      const media = img.closest(".set-card-media");
      if (media) media.style.display = "none";
    });
  });
}

async function runSearch(q) {
  const status = document.getElementById("search-status");
  if (status) status.textContent = "Searching database...";

  try {
    const payload = await apiGet(`/api/sets?q=${encodeURIComponent(q)}&limit=36`);
    renderResults(payload.results || []);
    if (status) status.textContent = `${payload.count || 0} result(s)`;
  } catch (error) {
    if (status) status.textContent = `Error: ${error.message}`;
  }
}

function init() {
  const params = new URLSearchParams(window.location.search);
  const initialQ = (params.get("q") || "").trim();

  const input = document.getElementById("search-input");
  if (input) input.value = initialQ;

  const form = document.getElementById("search-form");
  if (form) {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const q = (input?.value || "").trim();
      const next = new URL(window.location.href);
      if (q) next.searchParams.set("q", q);
      else next.searchParams.delete("q");
      window.history.replaceState({}, "", next);
      runSearch(q);
    });
  }

  runSearch(initialQ);
}

init();

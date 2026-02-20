import { apiGet, fmtInt, fmtYear } from "./api-client.js";

let allResults = [];
let selectedThemes = new Set();

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

function normalizeTheme(theme) {
  const raw = String(theme || "").trim();
  return raw || "Unknown";
}

function renderResults(results) {
  const container = document.getElementById("results");
  if (!container) return;

  if (!results.length) {
    container.innerHTML = "<article class='card'><h3>No set found</h3><p class='muted'>Try a different set number/title or remove a theme filter.</p></article>";
    return;
  }

  container.innerHTML = results.map((set) => {
    const rawSetNo = String(set.set_number || "").trim();
    const safeSetNo = normalizeImageSetNumber(rawSetNo);
    const setNo = escapeHtml(rawSetNo || "Unknown");
    const title = escapeHtml(set.title || "Untitled set");
    const theme = escapeHtml(set.theme || "Theme unavailable");
    const hasPrice = set.rrp_gbp !== null && set.rrp_gbp !== undefined && set.rrp_gbp !== "";
    const price = hasPrice ? `RRP GBP ${Number(set.rrp_gbp).toFixed(2)}` : "Price unavailable";
    const rrpDisplay = hasPrice ? `GBP ${Number(set.rrp_gbp).toFixed(2)}` : "Price unavailable";
    const imageBlock = safeSetNo
      ? `<div class='set-card-media'><img class='set-card-image' data-box-image='true' data-set-no='${escapeHtml(safeSetNo)}' loading='lazy' src='/set-images/${encodeURIComponent(safeSetNo)}/thumb.jpg' alt='Set ${setNo} in-box image' /></div>`
      : "";

    return `<a class='search-result-link' href='/set-page?set=${encodeURIComponent(rawSetNo || setNo)}' aria-label='Open set page for ${setNo} ${title}'><article class='card search-result-card'>${imageBlock}<div class='search-price-bar'><span class='search-price-badge'>LEGO SET</span><span class='search-price-value'>${escapeHtml(rrpDisplay)}</span></div><div class='search-result-body'><p class='search-theme'>${theme.toUpperCase()}</p><h3 class='search-title'>${setNo} ${title}</h3><p class='muted search-meta'>Pieces: ${fmtInt(set.pieces)} | Release year: ${fmtYear(set.release_year)} | ${escapeHtml(price)}</p><span class='btn'>Open Set Page</span></div></article></a>`;
  }).join("");

  container.querySelectorAll("img[data-box-image='true']").forEach((img) => {
    img.addEventListener("error", () => {
      const setNo = String(img.getAttribute("data-set-no") || "").trim();
      if (!img.dataset.fallbackTried && setNo) {
        img.dataset.fallbackTried = "true";
        img.src = `/set-images/${encodeURIComponent(setNo)}/box.jpg`;
        return;
      }
      const media = img.closest(".set-card-media");
      if (media) media.style.display = "none";
    });
  });
}

function getThemeSummary(results) {
  const counts = new Map();
  results.forEach((set) => {
    const theme = normalizeTheme(set.theme);
    counts.set(theme, (counts.get(theme) || 0) + 1);
  });
  return [...counts.entries()]
    .map(([theme, count]) => ({ theme, count }))
    .sort((a, b) => a.theme.localeCompare(b.theme, "en-GB"));
}

function getFilteredResults() {
  if (!selectedThemes.size) return allResults;
  return allResults.filter((set) => selectedThemes.has(normalizeTheme(set.theme)));
}

function updateSearchStatus() {
  const status = document.getElementById("search-status");
  if (!status) return;

  const filtered = getFilteredResults();
  if (selectedThemes.size) {
    const label = selectedThemes.size === 1 ? "theme filter" : "theme filters";
    status.textContent = `${filtered.length} of ${allResults.length} result(s) | ${selectedThemes.size} ${label} active`;
    return;
  }
  status.textContent = `${allResults.length} result(s)`;
}

function renderThemeFilters(results) {
  const container = document.getElementById("theme-filters");
  const status = document.getElementById("theme-filter-status");
  const clearButton = document.getElementById("clear-theme-filters");
  if (!container || !status || !clearButton) return;

  const themes = getThemeSummary(results);
  if (!themes.length) {
    container.innerHTML = "";
    status.textContent = "No themes available for this search.";
    clearButton.disabled = true;
    return;
  }

  status.textContent = `${themes.length} theme(s) available`;
  container.innerHTML = themes.map(({ theme, count }) => {
    const safeTheme = escapeHtml(theme);
    return `<label class='theme-filter-option'><input type='checkbox' value='${safeTheme}' /> <span class='theme-filter-name'>${safeTheme}</span> <span class='theme-filter-count'>(${count})</span></label>`;
  }).join("");

  container.querySelectorAll("input[type='checkbox']").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      const theme = checkbox.value;
      if (checkbox.checked) selectedThemes.add(theme);
      else selectedThemes.delete(theme);

      renderResults(getFilteredResults());
      updateSearchStatus();
      clearButton.disabled = selectedThemes.size === 0;
    });
  });

  clearButton.disabled = true;
  clearButton.onclick = () => {
    selectedThemes = new Set();
    container.querySelectorAll("input[type='checkbox']").forEach((checkbox) => {
      checkbox.checked = false;
    });
    renderResults(allResults);
    updateSearchStatus();
    clearButton.disabled = true;
  };
}

async function runSearch(q) {
  const status = document.getElementById("search-status");
  if (status) status.textContent = "Searching database...";

  try {
    const payload = await apiGet(`/api/sets?q=${encodeURIComponent(q)}&limit=36`);
    allResults = payload.results || [];
    selectedThemes = new Set();
    renderThemeFilters(allResults);
    renderResults(allResults);
    updateSearchStatus();
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

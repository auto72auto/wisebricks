import { apiGet, fmtInt, fmtYear } from "./api-client.js";

const PAGE_SIZE = 36;
const PRICE_BUCKETS = [
  { key: "under_25", label: "Under £25" },
  { key: "from_25_to_50", label: "£25 to £49.99" },
  { key: "from_50_to_100", label: "£50 to £99.99" },
  { key: "from_100_to_200", label: "£100 to £199.99" },
  { key: "over_200", label: "£200 and above" },
  { key: "no_price", label: "No known price" },
];

let allResults = [];
let selectedThemes = new Set();
let selectedPriceBuckets = new Set();
let activeQuery = "";
let sortBy = "set_number";
let sortDir = "asc";
let totalCount = 0;
let isLoading = false;
let hasMore = true;
let observer = null;

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

function appendResults(results) {
  const container = document.getElementById("results");
  if (!container || !results.length) return;

  const html = results.map((set) => {
    const rawSetNo = String(set.set_number || "").trim();
    const safeSetNo = normalizeImageSetNumber(rawSetNo);
    const setNo = escapeHtml(rawSetNo || "Unknown");
    const title = escapeHtml(set.title || "Untitled set");
    const theme = escapeHtml(set.theme || "Theme unavailable");
    const hasPrice = set.rrp_gbp !== null && set.rrp_gbp !== undefined && set.rrp_gbp !== "";
    const price = hasPrice ? `RRP £${Number(set.rrp_gbp).toFixed(2)}` : "Price unavailable";
    const rrpDisplay = hasPrice ? `£${Number(set.rrp_gbp).toFixed(2)}` : "Price unavailable";
    const imageBlock = safeSetNo
      ? `<div class='set-card-media'><img class='set-card-image' data-box-image='true' data-set-no='${escapeHtml(safeSetNo)}' loading='lazy' src='/set-images/${encodeURIComponent(safeSetNo)}/thumb.jpg' alt='Set ${setNo} in-box image' /></div>`
      : "";
    return `<a class='search-result-link' href='/set-page?set=${encodeURIComponent(rawSetNo || setNo)}' aria-label='Open set page for ${setNo} ${title}'><article class='card search-result-card'>${imageBlock}<div class='search-price-bar'><span class='search-price-badge'>LEGO SET</span><span class='search-price-value'>${escapeHtml(rrpDisplay)}</span></div><div class='search-result-body'><p class='search-theme'>${theme.toUpperCase()}</p><h3 class='search-title'>${setNo} ${title}</h3><p class='muted search-meta'>Pieces: ${fmtInt(set.pieces)} | Release year: ${fmtYear(set.release_year)} | ${escapeHtml(price)}</p><span class='btn'>Open Set Page</span></div></article></a>`;
  }).join("");

  container.insertAdjacentHTML("beforeend", html);
  container.querySelectorAll("img[data-box-image='true']").forEach((img) => {
    if (img.dataset.errorBound === "true") return;
    img.dataset.errorBound = "true";
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

function resetResultsView() {
  const container = document.getElementById("results");
  if (container) container.innerHTML = "";
}

function updateSearchStatus() {
  const status = document.getElementById("search-status");
  if (!status) return;

  const totalFilterCount = selectedThemes.size + selectedPriceBuckets.size;
  if (!allResults.length && !isLoading) {
    status.textContent = "No set found for the current search/filter.";
    return;
  }

  const filterText = totalFilterCount ? ` | ${totalFilterCount} filter${totalFilterCount === 1 ? "" : "s"} active` : "";
  const loadingText = isLoading && hasMore ? " | Loading more..." : "";
  status.textContent = `${allResults.length} of ${totalCount} result(s)${filterText}${loadingText}`;
}

function buildSearchApiPath(offset) {
  const params = new URLSearchParams();
  params.set("q", activeQuery);
  params.set("limit", String(PAGE_SIZE));
  params.set("offset", String(offset));
  params.set("sort_by", sortBy);
  params.set("sort_dir", sortDir);
  if (selectedThemes.size) params.set("themes", [...selectedThemes].join(","));
  if (selectedPriceBuckets.size) params.set("price_buckets", [...selectedPriceBuckets].join(","));
  return `/api/sets?${params.toString()}`;
}

async function loadNextPage() {
  if (isLoading || !hasMore) return;
  isLoading = true;
  updateSearchStatus();

  try {
    const payload = await apiGet(buildSearchApiPath(allResults.length));
    const nextChunk = payload.results || [];
    totalCount = Number(payload.total_count || 0);

    if (!nextChunk.length && !allResults.length) {
      resetResultsView();
      hasMore = false;
      return;
    }

    allResults = allResults.concat(nextChunk);
    appendResults(nextChunk);
    hasMore = allResults.length < totalCount;
  } catch (error) {
    const status = document.getElementById("search-status");
    if (status) status.textContent = `Error: ${error.message}`;
    hasMore = false;
  } finally {
    isLoading = false;
    updateSearchStatus();
  }
}

async function refreshSearch() {
  hasMore = true;
  isLoading = false;
  totalCount = 0;
  allResults = [];
  resetResultsView();
  updateSearchStatus();
  await loadNextPage();
}

function renderThemeFilters(themes) {
  const container = document.getElementById("theme-filters");
  const status = document.getElementById("theme-filter-status");
  const clearButton = document.getElementById("clear-theme-filters");
  if (!container || !status || !clearButton) return;

  const sortedThemes = [...themes].sort((a, b) => String(a.theme || "").localeCompare(String(b.theme || ""), "en-GB"));
  if (!sortedThemes.length) {
    container.innerHTML = "";
    status.textContent = "No themes available.";
    clearButton.disabled = true;
    return;
  }

  status.textContent = `${sortedThemes.length} theme(s) available`;
  container.innerHTML = sortedThemes.map((row) => {
    const theme = String(row.theme || "Unknown");
    return `<label class='theme-filter-option'><input type='checkbox' value='${escapeHtml(theme)}' /> <span class='theme-filter-name'>${escapeHtml(theme)}</span> <span class='theme-filter-count'>(${fmtInt(row.set_count)})</span></label>`;
  }).join("");

  container.querySelectorAll("input[type='checkbox']").forEach((checkbox) => {
    checkbox.addEventListener("change", async () => {
      const theme = checkbox.value;
      if (checkbox.checked) selectedThemes.add(theme);
      else selectedThemes.delete(theme);
      clearButton.disabled = selectedThemes.size === 0;
      await refreshSearch();
    });
  });

  clearButton.disabled = true;
  clearButton.onclick = async () => {
    selectedThemes = new Set();
    container.querySelectorAll("input[type='checkbox']").forEach((checkbox) => {
      checkbox.checked = false;
    });
    clearButton.disabled = true;
    await refreshSearch();
  };
}

function renderPriceFilters() {
  const container = document.getElementById("price-filters");
  const clearButton = document.getElementById("clear-price-filters");
  if (!container || !clearButton) return;

  container.innerHTML = PRICE_BUCKETS.map((bucket) => {
    return `<label class='theme-filter-option'><input type='checkbox' value='${bucket.key}' /> <span class='theme-filter-name'>${escapeHtml(bucket.label)}</span></label>`;
  }).join("");

  container.querySelectorAll("input[type='checkbox']").forEach((checkbox) => {
    checkbox.addEventListener("change", async () => {
      const bucket = checkbox.value;
      if (checkbox.checked) selectedPriceBuckets.add(bucket);
      else selectedPriceBuckets.delete(bucket);
      clearButton.disabled = selectedPriceBuckets.size === 0;
      await refreshSearch();
    });
  });

  clearButton.disabled = true;
  clearButton.onclick = async () => {
    selectedPriceBuckets = new Set();
    container.querySelectorAll("input[type='checkbox']").forEach((checkbox) => {
      checkbox.checked = false;
    });
    clearButton.disabled = true;
    await refreshSearch();
  };
}

function initSortControls() {
  const sortBySelect = document.getElementById("sort-by");
  const sortDirSelect = document.getElementById("sort-dir");
  if (!sortBySelect || !sortDirSelect) return;

  sortBySelect.value = sortBy;
  sortDirSelect.value = sortDir;

  sortBySelect.addEventListener("change", async () => {
    sortBy = sortBySelect.value;
    await refreshSearch();
  });

  sortDirSelect.addEventListener("change", async () => {
    sortDir = sortDirSelect.value;
    await refreshSearch();
  });
}

async function loadThemeOptions() {
  const status = document.getElementById("theme-filter-status");
  if (status) status.textContent = "Loading themes...";

  try {
    const payload = await apiGet("/api/themes?limit=500");
    renderThemeFilters(payload.themes || []);
  } catch (error) {
    if (status) status.textContent = `Error loading themes: ${error.message}`;
  }
}

function setupInfiniteScroll() {
  const sentinel = document.getElementById("results-sentinel");
  if (!sentinel) return;

  observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) loadNextPage();
    });
  }, { rootMargin: "300px 0px" });

  observer.observe(sentinel);
}

function init() {
  const params = new URLSearchParams(window.location.search);
  activeQuery = (params.get("q") || "").trim();

  const input = document.getElementById("search-input");
  if (input) input.value = activeQuery;

  const form = document.getElementById("search-form");
  if (form) {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      activeQuery = (input?.value || "").trim();
      const next = new URL(window.location.href);
      if (activeQuery) next.searchParams.set("q", activeQuery);
      else next.searchParams.delete("q");
      window.history.replaceState({}, "", next);
      await refreshSearch();
    });
  }

  initSortControls();
  renderPriceFilters();
  setupInfiniteScroll();
  loadThemeOptions();
  refreshSearch();
}

init();

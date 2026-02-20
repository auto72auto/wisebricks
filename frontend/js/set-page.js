import { apiGet, fmtInt, fmtYear, fmtGbp } from "./api-client.js";
import { getReviewForSet } from "./review-map.js";

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

function fmtIsoDate(value) {
  if (!value) return "Unavailable";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "Unavailable";
  return dt.toISOString().slice(0, 10);
}

function normalizeImageSetNumber(setNumber) {
  const raw = String(setNumber || "").trim();
  if (!raw) return "";
  const cleaned = raw.replace(/[^0-9A-Za-z_-]/g, "");
  const variantMatch = cleaned.match(/^([0-9]{3,8})-[0-9]+$/);
  return variantMatch ? variantMatch[1] : cleaned;
}

function normalizeImageUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw) || raw.startsWith("/")) return raw;
  return `/${raw.replace(/^\.?\//, "")}`;
}

function renderSetHeroImage(set, requestedSetNumber) {
  const img = document.getElementById("set-hero-image");
  const fallback = document.getElementById("set-hero-fallback");
  if (!img) return;

  const safeSetNo = normalizeImageSetNumber(set?.set_number || requestedSetNumber);
  const candidates = [
    normalizeImageUrl(set?.image_hero_url),
    normalizeImageUrl(set?.image_box_url),
    normalizeImageUrl(set?.image_thumb_url),
    safeSetNo ? `/set-images/${encodeURIComponent(safeSetNo)}/hero.jpg` : "",
    safeSetNo ? `/set-images/${encodeURIComponent(safeSetNo)}/box.jpg` : "",
    safeSetNo ? `/set-images/${encodeURIComponent(safeSetNo)}/thumb.jpg` : "",
  ].filter(Boolean);

  const uniqueCandidates = [...new Set(candidates)];
  img.alt = set?.title ? `${set.title} hero image` : `Set ${safeSetNo || requestedSetNumber} hero image`;

  let index = 0;
  const tryNext = () => {
    if (index >= uniqueCandidates.length) {
      img.hidden = true;
      if (fallback) fallback.hidden = false;
      return;
    }
    img.src = uniqueCandidates[index];
    index += 1;
  };

  img.onerror = () => tryNext();
  img.onload = () => {
    img.hidden = false;
    if (fallback) fallback.hidden = true;
  };

  if (!uniqueCandidates.length) {
    img.hidden = true;
    if (fallback) fallback.hidden = false;
    return;
  }

  tryNext();
}

function updateReviewBlock(setNumber, fallbackTitle) {
  const review = getReviewForSet(setNumber);
  const linkEl = document.getElementById("review-link");

  if (!review) {
    setText("review-summary", `No full review is published yet for ${fallbackTitle || `set ${setNumber}`}.`);
    if (linkEl) {
      linkEl.href = "reviews/index.html";
      linkEl.textContent = "Browse available reviews";
    }
    return;
  }

  setText("review-summary", review.summary || `${review.title || fallbackTitle || `Set ${setNumber}`} review available.`);
  if (linkEl) {
    linkEl.href = review.href;
    linkEl.textContent = "Read full review";
  }
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
    renderSetHeroImage(set, set.set_number || setNumber);
    updateReviewBlock(set.set_number || setNumber, set.title || "this set");
    renderRetailers(payload.retailers);
    setText("last-checked", fmtIsoDate(payload.last_checked || set.last_checked || payload.checked_at || payload.observed_at));
    setText("tracking-since", fmtIsoDate(payload.tracking_since || set.tracking_since || payload.first_seen_at));
    setText("set-status", "Live from database");
  } catch (error) {
    setText("set-status", `Error: ${error.message}`);
    renderSetHeroImage({}, setNumber);
    renderRetailers([]);
    setText("last-checked", "Unavailable");
    setText("tracking-since", "Unavailable");
    updateReviewBlock(setNumber, "this set");
  }
}

init();

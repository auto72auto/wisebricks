import { apiGet, fmtGbp, fmtInt } from "./api-client.js";

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function fmtPct(value) {
  const n = Number(value);
  return Number.isFinite(n) ? `-${Math.abs(n).toFixed(1)}%` : "Unavailable";
}

function fmtSnapshot(value) {
  if (!value) return "Unavailable";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "Unavailable";
  return dt.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizeImageUrl(set) {
  const candidates = [set?.image_thumb_url, set?.image_box_url, set?.image_hero_url]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  if (candidates.length) return candidates[0];
  const setNo = String(set?.set_number || "").trim();
  return setNo ? `/set-images/${encodeURIComponent(setNo)}/thumb.jpg` : "";
}

function renderTopDiscounts(rows) {
  const host = document.getElementById("home-top-discounts");
  if (!host) return;

  if (!rows.length) {
    host.innerHTML = "<p class='muted'>No discounted sets are currently available below RRP.</p>";
    return;
  }

  host.innerHTML = rows.map((row) => {
    const set = row.set || {};
    const imageUrl = normalizeImageUrl(set);
    const setNo = escapeHtml(set.set_number || "Unknown");
    const title = escapeHtml(set.title || "Untitled set");
    const retailer = escapeHtml(row.retailer || "Retailer");
    const retailerUrl = escapeHtml(row.retailer_url || `/set-page?set=${encodeURIComponent(set.set_number || "")}`);
    const setPageUrl = `/set-page?set=${encodeURIComponent(set.set_number || "")}`;
    return `
      <article class='card'>
        ${imageUrl ? `<img src='${escapeHtml(imageUrl)}' alt='${title} image' style='width:100%;max-width:220px;height:auto;border-radius:10px;margin-bottom:12px' />` : ""}
        <p class='search-theme'>${retailer.toUpperCase()}</p>
        <h3>${setNo} ${title}</h3>
        <p class='muted'>Now ${escapeHtml(fmtGbp(row.now_price))} | ${escapeHtml(fmtPct(row.discount_pct))} below RRP</p>
        <div class='pill-row'>
          <a class='btn' href='${setPageUrl}'>Open Set</a>
          <a class='btn' href='${retailerUrl}' target='_blank' rel='noopener noreferrer'>Cheapest Store</a>
        </div>
      </article>
    `;
  }).join("");
}

async function init() {
  try {
    const payload = await apiGet("/api/home");
    const stats = payload.stats || {};
    const biggestDiscount = payload.biggest_discount || null;

    setText("stat-tracked-sets", fmtInt(stats.tracked_sets));
    setText("stat-retailers-monitored", fmtInt(stats.retailers_monitored));
    setText("stat-discounted-sets", fmtInt(stats.discounted_sets));
    setText("stat-biggest-discount", biggestDiscount ? fmtPct(biggestDiscount.discount_pct) : "Unavailable");
    setText("stat-avg-discount", Number.isFinite(Number(stats.avg_discount_pct)) ? `${Number(stats.avg_discount_pct).toFixed(1)}%` : "Unavailable");
    setText("stat-in-stock-coverage", Number.isFinite(Number(stats.in_stock_coverage_pct)) ? `${Number(stats.in_stock_coverage_pct).toFixed(1)}%` : "Unavailable");
    setText("stat-latest-snapshot", fmtSnapshot(stats.latest_snapshot_at));

    const biggestDiscountLink = document.getElementById("stat-biggest-discount-link");
    if (biggestDiscountLink && biggestDiscount?.set?.set_number) {
      biggestDiscountLink.href = `/set-page?set=${encodeURIComponent(biggestDiscount.set.set_number)}`;
    }

    renderTopDiscounts(payload.top_discounts || []);
  } catch (error) {
    setText("stat-tracked-sets", "Unavailable");
    setText("stat-retailers-monitored", "Unavailable");
    setText("stat-discounted-sets", "Unavailable");
    setText("stat-biggest-discount", "Unavailable");
    setText("stat-avg-discount", "Unavailable");
    setText("stat-in-stock-coverage", "Unavailable");
    setText("stat-latest-snapshot", "Unavailable");
    renderTopDiscounts([]);
  }
}

init();

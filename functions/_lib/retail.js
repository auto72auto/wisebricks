const RETAILER_CONFIG = [
  { retailer_key: "amazon_uk", retailer: "Amazon UK", price_col: "amazon_uk_price", status_col: "amazon_uk_status", url_col: "amazon_uk_url" },
  { retailer_key: "argos", retailer: "Argos", price_col: "argos_price", status_col: "argos_status", url_col: "argos_url" },
  { retailer_key: "john_lewis", retailer: "John Lewis", price_col: "john_lewis_price", status_col: "john_lewis_status", url_col: "john_lewis_url" },
  { retailer_key: "lego_uk", retailer: "LEGO UK", price_col: "lego_uk_price", status_col: "lego_uk_status", url_col: "lego_uk_url" },
  { retailer_key: "smyths", retailer: "Smyths", price_col: "smyths_price", status_col: "smyths_status", url_col: "smyths_url" },
];

function toNum(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toPositivePrice(value) {
  const parsed = toNum(value);
  return parsed !== null && parsed > 0 ? parsed : null;
}

export function buildRetailerRows(snapshot, rrpGbp) {
  if (!snapshot) return [];

  return RETAILER_CONFIG.map((config) => {
    const price_gbp = toPositivePrice(snapshot[config.price_col]);
    const status = String(snapshot[config.status_col] || "").trim() || "unknown";
    const product_url = String(snapshot[config.url_col] || "").trim();
    const pct_vs_rrp =
      price_gbp === null || rrpGbp === null || rrpGbp === 0
        ? null
        : Number((((price_gbp - rrpGbp) / rrpGbp) * 100).toFixed(1));

    return {
      retailer_key: config.retailer_key,
      retailer: config.retailer,
      product_url,
      price_gbp,
      stock_state: status,
      availability_status: status,
      pct_vs_rrp,
    };
  }).filter((row) => row.price_gbp !== null);
}

export function getRetailPriceRange(rows) {
  const prices = rows.map((row) => toPositivePrice(row.price_gbp)).filter((value) => value !== null);
  if (!prices.length) {
    return {
      lowest_current_price_gbp: null,
      highest_current_price_gbp: null,
    };
  }

  prices.sort((a, b) => a - b);
  return {
    lowest_current_price_gbp: prices[0],
    highest_current_price_gbp: prices[prices.length - 1],
  };
}

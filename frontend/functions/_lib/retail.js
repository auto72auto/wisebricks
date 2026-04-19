export const RETAILER_CONFIG = [
  { retailer_key: "lego_uk", retailer: "LEGO UK", price_col: "lego_uk_price", status_col: "lego_uk_status", url_col: "lego_uk_url" },
  { retailer_key: "amazon_uk", retailer: "Amazon UK", price_col: "amazon_uk_price", status_col: "amazon_uk_status", url_col: "amazon_uk_url" },
  { retailer_key: "smyths", retailer: "Smyths", price_col: "smyths_price", status_col: "smyths_status", url_col: "smyths_url" },
  { retailer_key: "argos", retailer: "Argos", price_col: "argos_price", status_col: "argos_status", url_col: "argos_url" },
  { retailer_key: "john_lewis", retailer: "John Lewis", price_col: "john_lewis_price", status_col: "john_lewis_status", url_col: "john_lewis_url" },
  { retailer_key: "brick_shack", retailer: "Brick Shack", price_col: "brick_shack_price", status_col: "brick_shack_status", url_col: "brick_shack_url" },
  { retailer_key: "coolshop", retailer: "Coolshop", price_col: "coolshop_price", status_col: "coolshop_status", url_col: "coolshop_url" },
  { retailer_key: "currys", retailer: "Currys", price_col: "currys_price", status_col: "currys_status", url_col: "currys_url" },
  { retailer_key: "debenhams", retailer: "Debenhams", price_col: "debenhams_price", status_col: "debenhams_status", url_col: "debenhams_url" },
  { retailer_key: "downtown", retailer: "Downtown", price_col: "downtown_price", status_col: "downtown_status", url_col: "downtown_url" },
  { retailer_key: "hamleys", retailer: "Hamleys", price_col: "hamleys_price", status_col: "hamleys_status", url_col: "hamleys_url" },
  { retailer_key: "hillians", retailer: "Hillians", price_col: "hillians_price", status_col: "hillians_status", url_col: "hillians_url" },
  { retailer_key: "jadlam", retailer: "Jadlam", price_col: "jadlam_price", status_col: "jadlam_status", url_col: "jadlam_url" },
  { retailer_key: "jarrold", retailer: "Jarrold", price_col: "jarrold_price", status_col: "jarrold_status", url_col: "jarrold_url" },
  { retailer_key: "roys", retailer: "Roys", price_col: "roys_price", status_col: "roys_status", url_col: "roys_url" },
  { retailer_key: "sainsburys", retailer: "Sainsbury's", price_col: "sainsburys_price", status_col: "sainsburys_status", url_col: "sainsburys_url" },
  { retailer_key: "sam_turner", retailer: "Sam Turner", price_col: "sam_turner_price", status_col: "sam_turner_status", url_col: "sam_turner_url" },
  { retailer_key: "tesco", retailer: "Tesco", price_col: "tesco_price", status_col: "tesco_status", url_col: "tesco_url" },
  { retailer_key: "wonderland", retailer: "Wonderland", price_col: "wonderland_price", status_col: "wonderland_status", url_col: "wonderland_url" },
  { retailer_key: "zavvi", retailer: "Zavvi", price_col: "zavvi_price", status_col: "zavvi_status", url_col: "zavvi_url" },
];

function toNum(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toPositivePrice(value) {
  const parsed = toNum(value);
  return parsed !== null && parsed > 0 ? parsed : null;
}

export function getBestRetailOffer(snapshot, rrpGbp) {
  if (!snapshot) return null;

  let bestOffer = null;
  for (const config of RETAILER_CONFIG) {
    const price_gbp = toPositivePrice(snapshot[config.price_col]);
    if (price_gbp === null) continue;

    const discount_gbp =
      rrpGbp === null ? null : Number((rrpGbp - price_gbp).toFixed(2));
    const discount_pct =
      rrpGbp === null || rrpGbp === 0
        ? null
        : Number((((rrpGbp - price_gbp) / rrpGbp) * 100).toFixed(1));
    const offer = {
      retailer_key: config.retailer_key,
      retailer: config.retailer,
      price_gbp,
      product_url: String(snapshot[config.url_col] || "").trim() || null,
      discount_gbp,
      discount_pct,
    };

    if (
      !bestOffer ||
      price_gbp < bestOffer.price_gbp ||
      (price_gbp === bestOffer.price_gbp &&
        config.retailer_key.localeCompare(bestOffer.retailer_key) < 0)
    ) {
      bestOffer = offer;
    }
  }

  return bestOffer;
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

export function buildMarketplaceRows(setNumber, retailSnapshot, secondarySnapshot, rrpGbp) {
  const safeSetNumber = String(setNumber || "").trim();
  if (!safeSetNumber) return [];

  const rows = [
    {
      retailer_key: "bricklink",
      retailer: "BrickLink",
      product_url: `https://www.bricklink.com/v2/catalog/catalogitem.page?S=${encodeURIComponent(safeSetNumber)}-1`,
      price_gbp: toPositivePrice(secondarySnapshot?.bl_new_lowest_ask_gbp),
      stock_state: "varies",
      availability_status: "varies",
    },
    {
      retailer_key: "ebay_uk",
      retailer: "eBay UK",
      product_url: `https://www.ebay.co.uk/sch/i.html?_nkw=LEGO+${encodeURIComponent(safeSetNumber)}&LH_BIN=1`,
      price_gbp: toPositivePrice(retailSnapshot?.ebay_uk_new_buy_now_low),
      stock_state: "varies",
      availability_status: "varies",
    },
  ];

  return rows
    .map((row) => ({
      ...row,
      pct_vs_rrp:
        row.price_gbp === null || rrpGbp === null || rrpGbp === 0
          ? null
          : Number((((row.price_gbp - rrpGbp) / rrpGbp) * 100).toFixed(1)),
    }))
    .filter((row) => row.price_gbp !== null);
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

import { getSql, json } from "../_lib/db.js";
import { buildMarketplaceRows, getBestRetailOffer } from "../_lib/retail.js";
import { normalizeSet, parsePositiveInt } from "../_lib/sets.js";

function normalizeQuery(query) {
  return String(query || "").trim();
}

function parseNonNegativeInt(value, fallback) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function parseListParam(value) {
  const raw = String(value || "").trim();
  if (!raw) return [];
  return [...new Set(raw.split(",").map((item) => item.trim()).filter(Boolean))];
}

function parseSortBy(value) {
  const allowed = new Set(["set_number", "title", "price", "discount"]);
  return allowed.has(value) ? value : "discount";
}

function parseSortDir(value) {
  return value === "desc" ? "desc" : "asc";
}

function toNum(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function compareNullable(a, b, dir = "asc") {
  const aNull = a === null || a === undefined;
  const bNull = b === null || b === undefined;
  if (aNull && bNull) return 0;
  if (aNull) return 1;
  if (bNull) return -1;
  return dir === "desc" ? b - a : a - b;
}

function compareText(a, b, dir = "asc") {
  const result = String(a || "").localeCompare(String(b || ""), "en-GB", { numeric: true, sensitivity: "base" });
  return dir === "desc" ? -result : result;
}

function getMarketplaceFallbackOffer(setNumber, row, rrp) {
  const marketplaceRows = buildMarketplaceRows(setNumber, row, row, rrp);
  if (!marketplaceRows.length) return null;

  const cheapest = [...marketplaceRows].sort((a, b) => {
    if (a.price_gbp !== b.price_gbp) return a.price_gbp - b.price_gbp;
    return String(a.retailer_key || "").localeCompare(String(b.retailer_key || ""), "en-GB");
  })[0];

  return {
    retailer_key: cheapest.retailer_key,
    retailer: cheapest.retailer,
    price_gbp: cheapest.price_gbp,
    product_url: cheapest.product_url,
    discount_gbp:
      rrp === null ? null : Number((rrp - cheapest.price_gbp).toFixed(2)),
    discount_pct:
      rrp === null || rrp === 0
        ? null
        : Number((((rrp - cheapest.price_gbp) / rrp) * 100).toFixed(1)),
  };
}

export async function onRequestGet(context) {
  try {
    const sql = getSql(context);
    const url = new URL(context.request.url);
    const q = normalizeQuery(url.searchParams.get("q"));
    const like = `%${q}%`;
    const limit = parsePositiveInt(url.searchParams.get("limit"), 36);
    const offset = parseNonNegativeInt(url.searchParams.get("offset"), 0);
    const themes = parseListParam(url.searchParams.get("themes"));
    const hasThemes = themes.length > 0;

    const priceBuckets = parseListParam(url.searchParams.get("price_buckets"));
    const hasPriceBuckets = priceBuckets.length > 0;
    const includeUnder25 = priceBuckets.includes("under_25");
    const include25to50 = priceBuckets.includes("from_25_to_50");
    const include50to100 = priceBuckets.includes("from_50_to_100");
    const include100to200 = priceBuckets.includes("from_100_to_200");
    const includeOver200 = priceBuckets.includes("over_200");
    const includeNoPrice = priceBuckets.includes("no_price");

    const sortBy = parseSortBy(url.searchParams.get("sort_by"));
    const sortDir = parseSortDir(url.searchParams.get("sort_dir"));

    const rows = await sql`
      select
        s.set_number,
        s.title,
        s.piece_count,
        s.release_date,
        s.theme_name,
        s.rrp_gbp,
        s.image_thumb_url,
        s.image_box_url,
        s.image_hero_url,
        s.variant,
        rs.lego_uk_price,
        rs.lego_uk_url,
        rs.amazon_uk_price,
        rs.amazon_uk_url,
        rs.smyths_price,
        rs.smyths_url,
        rs.argos_price,
        rs.argos_url,
        rs.john_lewis_price,
        rs.john_lewis_url,
        rs.brick_shack_price,
        rs.brick_shack_url,
        rs.coolshop_price,
        rs.coolshop_url,
        rs.currys_price,
        rs.currys_url,
        rs.debenhams_price,
        rs.debenhams_url,
        rs.downtown_price,
        rs.downtown_url,
        rs.hamleys_price,
        rs.hamleys_url,
        rs.hillians_price,
        rs.hillians_url,
        rs.jadlam_price,
        rs.jadlam_url,
        rs.jarrold_price,
        rs.jarrold_url,
        rs.roys_price,
        rs.roys_url,
        rs.sainsburys_price,
        rs.sainsburys_url,
        rs.sam_turner_price,
        rs.sam_turner_url,
        rs.tesco_price,
        rs.tesco_url,
        rs.wonderland_price,
        rs.wonderland_url,
        rs.zavvi_price,
        rs.zavvi_url,
        coalesce(
          rs.ebay_uk_new_buy_now_low,
          (
            select min(rs2.ebay_uk_new_buy_now_low)
            from retail_snapshot rs2
            where rs2.set_number = s.set_number
              and rs2.ebay_uk_new_buy_now_low is not null
          )
        ) as ebay_uk_new_buy_now_low,
        coalesce(
          ss.bl_new_lowest_ask_gbp,
          (
            select min(ss2.bl_new_lowest_ask_gbp)
            from secondary_snapshot ss2
            where ss2.set_number = s.set_number
              and ss2.bl_new_lowest_ask_gbp is not null
          )
        ) as bl_new_lowest_ask_gbp
      from sets s
      left join retail_snapshot rs
        on rs.set_number = s.set_number
       and rs.variant = s.variant
      left join secondary_snapshot ss
        on ss.set_number = s.set_number
       and ss.variant = s.variant
      where (
        ${q === ""}
        or s.set_number ilike ${like}
        or s.title ilike ${like}
        or coalesce(s.theme_name, '') ilike ${like}
      )
        and (
          ${hasThemes === false}
          or coalesce(nullif(trim(s.theme_name), ''), 'Unknown') = any(${themes})
        )
        and (
          ${hasPriceBuckets === false}
          or (
            (${includeUnder25} and s.rrp_gbp is not null and s.rrp_gbp < 25)
            or (${include25to50} and s.rrp_gbp is not null and s.rrp_gbp >= 25 and s.rrp_gbp < 50)
            or (${include50to100} and s.rrp_gbp is not null and s.rrp_gbp >= 50 and s.rrp_gbp < 100)
            or (${include100to200} and s.rrp_gbp is not null and s.rrp_gbp >= 100 and s.rrp_gbp < 200)
            or (${includeOver200} and s.rrp_gbp is not null and s.rrp_gbp >= 200)
            or (${includeNoPrice} and s.rrp_gbp is null)
          )
        )
      order by s.set_number asc, s.variant asc
    `;

    const enrichedRows = rows.map((row) => {
      const set = normalizeSet(row);
      const rrp = toNum(set.rrp_gbp);
      const bestRetailOffer = getBestRetailOffer(row, rrp);
      const bestOffer = bestRetailOffer || getMarketplaceFallbackOffer(set.set_number, row, rrp);
      const bestPrice = bestOffer?.price_gbp ?? null;
      const pctBelowRrp =
        bestPrice === null || rrp === null || rrp === 0 || bestPrice >= rrp
          ? null
          : Number((((rrp - bestPrice) / rrp) * 100).toFixed(1));

      return {
        ...set,
        best_current_price_gbp: bestPrice,
        best_price_retailer: bestOffer?.retailer_key || null,
        pct_below_rrp: pctBelowRrp,
      };
    });

    enrichedRows.sort((a, b) => {
      if (sortBy === "discount") {
        const diff = compareNullable(a.pct_below_rrp, b.pct_below_rrp, sortDir);
        if (diff !== 0) return diff;
      } else if (sortBy === "price") {
        const diff = compareNullable(a.rrp_gbp, b.rrp_gbp, sortDir);
        if (diff !== 0) return diff;
      } else if (sortBy === "set_number") {
        const diff = compareText(a.set_number, b.set_number, sortDir);
        if (diff !== 0) return diff;
      } else if (sortBy === "title") {
        const diff = compareText(a.title, b.title, sortDir);
        if (diff !== 0) return diff;
      }

      const setNumberDiff = compareText(a.set_number, b.set_number, "asc");
      if (setNumberDiff !== 0) return setNumberDiff;
      return compareNullable(a.variant, b.variant, "asc");
    });

    const totalCount = enrichedRows.length;
    const results = enrichedRows.slice(offset, offset + limit);
    return json({
      query: q,
      offset,
      limit,
      count: results.length,
      total_count: totalCount,
      results,
      themes,
      price_buckets: priceBuckets,
      sort_by: sortBy,
      sort_dir: sortDir,
    });
  } catch (error) {
    return json({ error: "Failed to query sets", detail: String(error.message || error) }, { status: 500 });
  }
}

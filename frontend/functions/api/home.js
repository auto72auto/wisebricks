import { getSql, json } from "../_lib/db.js";
import { getBestRetailOffer } from "../_lib/retail.js";
import { normalizeSet } from "../_lib/sets.js";

const RETAILERS_MONITORED = 20;

function pickRetailerUrl(row, retailerKey) {
  const map = {
    lego_uk: row.lego_uk_url,
    amazon_uk: row.amazon_uk_url,
    smyths: row.smyths_url,
    argos: row.argos_url,
    john_lewis: row.john_lewis_url,
    brick_shack: row.brick_shack_url,
    coolshop: row.coolshop_url,
    debenhams: row.debenhams_url,
    downtown: row.downtown_url,
    hamleys: row.hamleys_url,
    hillians: row.hillians_url,
    jadlam: row.jadlam_url,
    jarrold: row.jarrold_url,
    roys: row.roys_url,
    sainsburys: row.sainsburys_url,
    sam_turner: row.sam_turner_url,
    tesco: row.tesco_url,
    wonderland: row.wonderland_url,
    zavvi: row.zavvi_url,
  };
  return map[retailerKey] || null;
}

function toPct(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toNum(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toIsoOrNull(value) {
  if (!value) return null;
  const dt = new Date(value);
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString();
}

export async function onRequestGet(context) {
  try {
    const sql = getSql(context);

    const rankedRows = await sql`
      with ranked as (
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
          rs.retailer_count_active,
          rs.last_updated,
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
          row_number() over (
            partition by s.set_number
            order by
              coalesce(rs.retailer_count_active, 0) desc,
              case
                when s.variant = 1 then 0
                when s.variant = 0 then 1
                when s.variant = -1 then 2
                else 3
              end asc,
              s.variant asc
          ) as rn
        from sets s
        left join retail_snapshot rs
          on rs.set_number = s.set_number
         and rs.variant = s.variant
      )
      select *
      from ranked
      where rn = 1
    `;

    let discountedSets = 0;
    let discountPctTotal = 0;
    let discountPctCount = 0;
    let inStockCount = 0;
    let latestSnapshotAt = null;

    const moverRows = rankedRows
      .map((row) => {
        const rrp = toNum(row.rrp_gbp);
        const bestOffer = getBestRetailOffer(row, rrp);

        if (toNum(row.retailer_count_active) > 0) {
          inStockCount += 1;
        }
        if (row.last_updated && (!latestSnapshotAt || new Date(row.last_updated) > new Date(latestSnapshotAt))) {
          latestSnapshotAt = row.last_updated;
        }
        if (!bestOffer || rrp === null || bestOffer.price_gbp >= rrp) {
          return null;
        }

        discountedSets += 1;
        if (bestOffer.discount_pct !== null) {
          discountPctTotal += bestOffer.discount_pct;
          discountPctCount += 1;
        }

        return {
          ...row,
          computed_best_price_gbp: bestOffer.price_gbp,
          computed_best_retailer_key: bestOffer.retailer_key,
          computed_best_retailer_url: bestOffer.product_url,
          computed_discount_gbp: bestOffer.discount_gbp,
          computed_discount_pct: bestOffer.discount_pct,
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        if ((b.computed_discount_pct ?? -Infinity) !== (a.computed_discount_pct ?? -Infinity)) {
          return (b.computed_discount_pct ?? -Infinity) - (a.computed_discount_pct ?? -Infinity);
        }
        if ((b.computed_discount_gbp ?? -Infinity) !== (a.computed_discount_gbp ?? -Infinity)) {
          return (b.computed_discount_gbp ?? -Infinity) - (a.computed_discount_gbp ?? -Infinity);
        }
        return String(a.set_number).localeCompare(String(b.set_number));
      })
      .slice(0, 3);

    const biggestDiscount = moverRows[0] || null;
    const avgDiscountPct =
      discountPctCount > 0 ? Number((discountPctTotal / discountPctCount).toFixed(1)) : null;

    return json({
      stats: {
        tracked_sets: rankedRows.length,
        retailers_monitored: RETAILERS_MONITORED,
        discounted_sets: discountedSets,
        avg_discount_pct: avgDiscountPct,
        in_stock_coverage_pct:
          rankedRows.length > 0 ? Number(((inStockCount * 100) / rankedRows.length).toFixed(1)) : null,
        latest_snapshot_at: toIsoOrNull(latestSnapshotAt),
      },
      biggest_discount: biggestDiscount
        ? {
            set: normalizeSet(biggestDiscount),
            discount_pct: toPct(biggestDiscount.computed_discount_pct),
            discount_gbp: toNum(biggestDiscount.computed_discount_gbp),
            retailer: biggestDiscount.computed_best_retailer_key || null,
            retailer_url:
              biggestDiscount.computed_best_retailer_url ||
              pickRetailerUrl(biggestDiscount, biggestDiscount.computed_best_retailer_key),
          }
        : null,
      top_discounts: moverRows.map((row) => ({
        set: normalizeSet(row),
        now_price: toNum(row.computed_best_price_gbp),
        discount_pct: toPct(row.computed_discount_pct),
        discount_gbp: toNum(row.computed_discount_gbp),
        retailer: row.computed_best_retailer_key || null,
        retailer_url:
          row.computed_best_retailer_url ||
          pickRetailerUrl(row, row.computed_best_retailer_key),
        latest_observation_at: toIsoOrNull(row.last_updated),
      })),
    });
  } catch (error) {
    return json({ error: "Failed to load homepage data", detail: String(error.message || error) }, { status: 500 });
  }
}

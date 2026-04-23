import { getSql, json } from "../_lib/db.js";
import { getBestRetailOffer } from "../_lib/retail.js";
import { normalizeSet, parsePositiveInt } from "../_lib/sets.js";
import { buildMarketplaceRows, buildRetailerRows, getRetailPriceRange } from "../_lib/retail.js";

function parseBoundedPositiveInt(value, fallback, max) {
  const parsed = parsePositiveInt(value, fallback);
  return Math.min(parsed, max);
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
  const url = new URL(context.request.url);
  const requestedSetNumber = String(
    url.searchParams.get("set") || url.searchParams.get("set_number") || ""
  ).trim();
  const comparablesLimit = parseBoundedPositiveInt(
    url.searchParams.get("comparables_limit"),
    6,
    20
  );
  const historyWeeks = parseBoundedPositiveInt(
    url.searchParams.get("history_weeks"),
    26,
    104
  );

  if (!requestedSetNumber) {
    return json({ error: "set query parameter is required" }, { status: 400 });
  }

  try {
    const sql = getSql(context);

    const setRows = await sql`
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
        s.variant
      from sets s
      left join retail_snapshot r
        on r.set_number = s.set_number
       and r.variant = s.variant
      where s.set_number = ${requestedSetNumber}
      order by
        coalesce(r.retailer_count_active, 0) desc,
        case
          when s.variant = 1 then 0
          when s.variant = 0 then 1
          when s.variant = -1 then 2
          else 3
        end asc,
        s.variant asc
      limit 1
    `;

    if (!setRows.length) {
      return json({ error: "Set not found" }, { status: 404 });
    }

    const set = normalizeSet(setRows[0]);
    const setVariant = set.variant ?? 1;
    const targetRrp = toNum(set.rrp_gbp);
    const targetPieces = Number.isFinite(set.pieces) ? set.pieces : null;
    const targetYear = Number.isFinite(set.release_year) ? set.release_year : null;
    const targetTheme = set.theme || null;
    const minComparableRrp = targetRrp === null ? null : targetRrp * 0.6;
    const maxComparableRrp = targetRrp === null ? null : targetRrp * 1.4;

    const retailRows = await sql`
      select
        *
      from retail_snapshot
      where set_number = ${set.set_number}
        and variant = ${setVariant}
      limit 1
    `;
    const retailSnapshot = retailRows[0] || null;
    const secondaryRows = await sql`
      select
        bl_new_lowest_ask_gbp
      from secondary_snapshot
      where set_number = ${set.set_number}
        and variant = ${setVariant}
      limit 1
    `;
    const secondarySnapshot = secondaryRows[0] || null;
    const currentRetailers = [
      ...buildRetailerRows(retailSnapshot, targetRrp),
      ...buildMarketplaceRows(set.set_number, retailSnapshot, secondarySnapshot, targetRrp),
    ];

    let comparables = [];
    let comparablesMode = "ok";
    try {
      comparables = await sql`
        select
          s.set_number,
          s.title,
          s.theme_name as theme,
          extract(year from s.release_date)::int as release_year,
          s.piece_count as pieces,
          s.rrp_gbp,
          r.last_updated as latest_observed_at,
          null::numeric as last_7d_avg_price_gbp,
          r.lego_uk_price,
          r.lego_uk_url,
          r.amazon_uk_price,
          r.amazon_uk_url,
          r.smyths_price,
          r.smyths_url,
          r.argos_price,
          r.argos_url,
          r.john_lewis_price,
          r.john_lewis_url,
          r.brick_shack_price,
          r.brick_shack_url,
          r.coolshop_price,
          r.coolshop_url,
          r.currys_price,
          r.currys_url,
          r.debenhams_price,
          r.debenhams_url,
          r.downtown_price,
          r.downtown_url,
          r.hamleys_price,
          r.hamleys_url,
          r.hillians_price,
          r.hillians_url,
          r.jadlam_price,
          r.jadlam_url,
          r.jarrold_price,
          r.jarrold_url,
          r.roys_price,
          r.roys_url,
          r.sainsburys_price,
          r.sainsburys_url,
          r.sam_turner_price,
          r.sam_turner_url,
          r.tesco_price,
          r.tesco_url,
          r.wonderland_price,
          r.wonderland_url,
          r.zavvi_price,
          r.zavvi_url
        from sets s
        left join retail_snapshot r
          on r.set_number = s.set_number
         and r.variant = s.variant
        where s.set_number <> ${set.set_number}
          and (${targetTheme === null} or s.theme_name = ${targetTheme})
          and (
            ${targetRrp === null}
            or (
              s.rrp_gbp is not null
              and s.rrp_gbp between ${minComparableRrp} and ${maxComparableRrp}
            )
          )
        order by
          (
            case
              when ${targetRrp === null || targetRrp === 0} then 0
              when s.rrp_gbp is null then 10
              else abs(s.rrp_gbp - ${targetRrp}) / ${targetRrp}
            end
            +
            case
              when ${targetPieces === null || targetPieces === 0} then 0
              when s.piece_count is null then 1
              else abs(s.piece_count - ${targetPieces})::numeric / ${targetPieces}
            end
            +
            case
              when ${targetYear === null} then 0
              when s.release_date is null then 1
              else abs(extract(year from s.release_date)::int - ${targetYear})::numeric / 10
            end
          ) asc,
          s.set_number asc
        limit ${comparablesLimit}
      `;
    } catch {
      comparablesMode = "unavailable";
      comparables = [];
    }

    comparables = comparables.map((row) => {
      const rrp = toNum(row.rrp_gbp);
      const bestOffer = getBestRetailOffer(row, rrp);
      return {
        set_number: row.set_number,
        title: row.title,
        theme: row.theme,
        release_year: row.release_year,
        pieces: row.pieces,
        rrp_gbp: rrp,
        best_current_price_gbp: bestOffer?.price_gbp ?? null,
        best_price_retailer: bestOffer?.retailer_key ?? null,
        best_price_pct_vs_rrp:
          bestOffer?.discount_pct !== null && bestOffer?.discount_pct !== undefined && bestOffer.price_gbp < rrp
            ? Number((-Math.abs(bestOffer.discount_pct)).toFixed(1))
            : null,
        latest_observed_at: row.latest_observed_at,
        last_7d_avg_price_gbp: row.last_7d_avg_price_gbp,
      };
    });

    const priceRange = getRetailPriceRange(currentRetailers);
    const snapshot = {
      retailer_count: currentRetailers.length,
      lowest_current_price_gbp: priceRange.lowest_current_price_gbp,
      highest_current_price_gbp: priceRange.highest_current_price_gbp,
      latest_observation_at: toIsoOrNull(retailSnapshot?.last_updated),
    };

    return json({
      generated_at: new Date().toISOString(),
      requested_set_number: requestedSetNumber,
      set,
      set_facts: {
        price_per_piece_gbp:
          targetRrp === null || !targetPieces || targetPieces <= 0
            ? null
            : Number((targetRrp / targetPieces).toFixed(4)),
      },
      snapshot,
      retailers: currentRetailers,
      history: {
        mode: "unavailable",
        weeks_requested: historyWeeks,
        points: [],
      },
      comparables: {
        mode: comparablesMode,
        limit: comparablesLimit,
        results: comparables,
      },
    });
  } catch (error) {
    return json(
      { error: "Failed to load review data", detail: String(error.message || error) },
      { status: 500 }
    );
  }
}

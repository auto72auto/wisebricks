import { getSql, json } from "../_lib/db.js";
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

    const [summaryRows, moverRows, updatesRows] = await Promise.all([
      sql`
        with ranked as (
          select
            s.set_number,
            s.variant,
            s.rrp_gbp,
            rs.lowest_retail_price,
            rs.discount_vs_rrp_pct,
            rs.retailer_count_active,
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
        select
          count(*)::int as tracked_sets,
          count(*) filter (
            where lowest_retail_price is not null
              and rrp_gbp is not null
              and lowest_retail_price < rrp_gbp
          )::int as discounted_sets,
          round(avg(discount_vs_rrp_pct * 100.0) filter (
            where discount_vs_rrp_pct is not null
              and lowest_retail_price is not null
              and rrp_gbp is not null
              and lowest_retail_price < rrp_gbp
          ), 1) as avg_discount_pct,
          round(
            100.0 * count(*) filter (where coalesce(retailer_count_active, 0) > 0) / nullif(count(*), 0),
            1
          ) as in_stock_coverage_pct
        from ranked
        where rn = 1
      `,
      sql`
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
            rs.lowest_retail_price,
            rs.lowest_retail_source,
            rs.discount_vs_rrp_gbp,
            rs.discount_vs_rrp_pct,
            rs.retailer_count_active,
            rs.lego_uk_url,
            rs.amazon_uk_url,
            rs.smyths_url,
            rs.argos_url,
            rs.john_lewis_url,
            rs.brick_shack_url,
            rs.coolshop_url,
            rs.debenhams_url,
            rs.downtown_url,
            rs.hamleys_url,
            rs.hillians_url,
            rs.jadlam_url,
            rs.jarrold_url,
            rs.roys_url,
            rs.sainsburys_url,
            rs.sam_turner_url,
            rs.tesco_url,
            rs.wonderland_url,
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
          join retail_snapshot rs
            on rs.set_number = s.set_number
           and rs.variant = s.variant
          where rs.lowest_retail_price is not null
            and s.rrp_gbp is not null
            and rs.lowest_retail_price < s.rrp_gbp
        )
        select *
        from ranked
        where rn = 1
        order by discount_vs_rrp_pct desc nulls last, discount_vs_rrp_gbp desc nulls last, set_number asc
        limit 3
      `,
      sql`
        select count(distinct set_number)::int as updated_sets_24h
        from retail_history
        where scraped_at >= now() - interval '24 hours'
      `,
    ]);

    const summary = summaryRows[0] || {};
    const biggestDiscount = moverRows[0] || null;

    return json({
      stats: {
        tracked_sets: Number(summary.tracked_sets || 0),
        retailers_monitored: RETAILERS_MONITORED,
        discounted_sets: Number(summary.discounted_sets || 0),
        avg_discount_pct: toPct(summary.avg_discount_pct),
        in_stock_coverage_pct: toPct(summary.in_stock_coverage_pct),
        retail_updates_24h: Number(updatesRows?.[0]?.updated_sets_24h || 0),
      },
      biggest_discount: biggestDiscount
        ? {
            set: normalizeSet(biggestDiscount),
            discount_pct: toPct(biggestDiscount.discount_vs_rrp_pct) == null
              ? null
              : Number((toPct(biggestDiscount.discount_vs_rrp_pct) * 100).toFixed(1)),
            discount_gbp: toNum(biggestDiscount.discount_vs_rrp_gbp),
            retailer: biggestDiscount.lowest_retail_source || null,
            retailer_url: pickRetailerUrl(biggestDiscount, biggestDiscount.lowest_retail_source),
          }
        : null,
      top_discounts: moverRows.map((row) => ({
        set: normalizeSet(row),
        now_price: toNum(row.lowest_retail_price),
        discount_pct: toPct(row.discount_vs_rrp_pct) == null
          ? null
          : Number((toPct(row.discount_vs_rrp_pct) * 100).toFixed(1)),
        discount_gbp: toNum(row.discount_vs_rrp_gbp),
        retailer: row.lowest_retail_source || null,
        retailer_url: pickRetailerUrl(row, row.lowest_retail_source),
        latest_observation_at: toIsoOrNull(row.last_updated),
      })),
    });
  } catch (error) {
    return json({ error: "Failed to load homepage data", detail: String(error.message || error) }, { status: 500 });
  }
}

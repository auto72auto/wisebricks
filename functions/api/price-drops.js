import { getSql, json } from "../_lib/db.js";
import { getBestRetailOffer } from "../_lib/retail.js";
import { parsePositiveInt } from "../_lib/sets.js";

async function withSnapshotDiscounts(sql, limit) {
  const rows = await sql`
    select
      s.set_number,
      s.title,
      s.rrp_gbp,
      r.variant,
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
    from retail_snapshot r
    join sets s
      on s.set_number = r.set_number
     and s.variant = r.variant
    where s.rrp_gbp is not null
    order by s.set_number asc, r.variant asc
  `;

  return rows
    .map((row) => {
      const bestOffer = getBestRetailOffer(row, Number(row.rrp_gbp));
      if (!bestOffer || bestOffer.price_gbp >= Number(row.rrp_gbp)) {
        return null;
      }

      return {
        set_number: row.set_number,
        title: row.title,
        retailer: bestOffer.retailer_key,
        now_price: bestOffer.price_gbp,
        rrp_gbp: Number(row.rrp_gbp),
        vs_rrp_pct: bestOffer.discount_pct,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if ((b.vs_rrp_pct ?? -Infinity) !== (a.vs_rrp_pct ?? -Infinity)) {
        return (b.vs_rrp_pct ?? -Infinity) - (a.vs_rrp_pct ?? -Infinity);
      }
      return String(a.set_number).localeCompare(String(b.set_number), "en-GB", { numeric: true, sensitivity: "base" });
    })
    .slice(0, limit);
}

async function fallbackFromSets(sql, limit) {
  return sql`
    select
      s.set_number,
      s.title,
      null::text as retailer,
      s.rrp_gbp as now_price,
      s.rrp_gbp,
      null::numeric as vs_rrp_pct
    from sets s
    where s.rrp_gbp is not null
    order by s.release_date desc nulls last, s.set_number asc
    limit ${limit}
  `;
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const limit = parsePositiveInt(url.searchParams.get("limit"), 100);

  try {
    const sql = getSql(context);

    try {
      const rows = await withSnapshotDiscounts(sql, limit);
      return json({ mode: "snapshot_discount_vs_rrp", rows });
    } catch {
      const rows = await fallbackFromSets(sql, limit);
      return json({ mode: "sets_rrp_fallback", rows });
    }
  } catch (error) {
    return json({ error: "Failed to load price drops", detail: String(error.message || error) }, { status: 500 });
  }
}

import { getSql, json } from "../_lib/db.js";
import { parsePositiveInt } from "../_lib/sets.js";

async function withSnapshotDiscounts(sql, limit) {
  return sql`
    select
      s.set_number,
      s.title,
      r.lowest_retail_source as retailer,
      r.lowest_retail_price as now_price,
      s.rrp_gbp as prev_price,
      round(((r.lowest_retail_price - s.rrp_gbp) / nullif(s.rrp_gbp, 0)) * 100.0, 1) as change_pct
    from retail_snapshot r
    join sets s
      on s.set_number = r.set_number
     and s.variant = r.variant
    where r.lowest_retail_price is not null
      and s.rrp_gbp is not null
      and r.lowest_retail_price < s.rrp_gbp
      and nullif(trim(
        case r.lowest_retail_source
          when 'lego_uk' then r.lego_uk_url
          when 'amazon_uk' then r.amazon_uk_url
          when 'smyths' then r.smyths_url
          when 'argos' then r.argos_url
          when 'john_lewis' then r.john_lewis_url
          when 'brick_shack' then r.brick_shack_url
          when 'coolshop' then r.coolshop_url
          when 'currys' then r.currys_url
          when 'debenhams' then r.debenhams_url
          when 'downtown' then r.downtown_url
          when 'hamleys' then r.hamleys_url
          when 'hillians' then r.hillians_url
          when 'jadlam' then r.jadlam_url
          when 'jarrold' then r.jarrold_url
          when 'roys' then r.roys_url
          when 'sainsburys' then r.sainsburys_url
          when 'sam_turner' then r.sam_turner_url
          when 'tesco' then r.tesco_url
          when 'wonderland' then r.wonderland_url
          when 'zavvi' then r.zavvi_url
          else null
        end
      ), '') is not null
    order by change_pct asc, s.set_number asc
    limit ${limit}
  `;
}

async function fallbackFromSets(sql, limit) {
  return sql`
    select
      s.set_number,
      s.title,
      null::text as retailer,
      s.rrp_gbp as now_price,
      null::numeric as prev_price,
      null::numeric as change_pct
    from sets s
    where s.rrp_gbp is not null
    order by s.release_date desc nulls last, s.set_number asc
    limit ${limit}
  `;
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const limit = parsePositiveInt(url.searchParams.get("limit"), 20);

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

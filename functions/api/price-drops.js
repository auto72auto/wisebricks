import { getSql, json } from "../_lib/db.js";
import { parsePositiveInt } from "../_lib/sets.js";

async function withObservedDrops(sql, limit) {
  return sql`
    with latest_vs_prev as (
      select
        c.set_number,
        c.variant,
        c.retailer_key,
        c.price_gbp as now_price,
        p.prev_price,
        round(((c.price_gbp - p.prev_price) / nullif(p.prev_price, 0)) * 100.0, 1) as change_pct
      from core.set_retailer_current c
      join lateral (
        select o.price_gbp as prev_price
        from core.set_retailer_observation o
        where o.set_number = c.set_number
          and o.variant = c.variant
          and o.retailer_key = c.retailer_key
          and o.price_gbp is not null
        order by o.observed_at desc
        offset 1
        limit 1
      ) p on true
      where c.price_gbp is not null
        and c.price_gbp < p.prev_price
    )
    select
      l.set_number,
      s.name as title,
      r.display_name as retailer,
      l.now_price,
      l.prev_price,
      l.change_pct
    from latest_vs_prev l
    join core.sets s
      on s.set_number = l.set_number
     and s.variant = l.variant
    left join core.retailers r
      on r.retailer_key = l.retailer_key
    order by l.change_pct asc
    limit ${limit}
  `;
}

async function fallbackFromSets(sql, limit) {
  return sql`
    select
      s.set_number,
      s.name as title,
      null::text as retailer,
      s.rrp_gbp as now_price,
      null::numeric as prev_price,
      null::numeric as change_pct
    from core.sets s
    where s.rrp_gbp is not null
    order by s.updated_at desc, s.set_number asc
    limit ${limit}
  `;
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const limit = parsePositiveInt(url.searchParams.get("limit"), 20);

  try {
    const sql = getSql(context);

    try {
      const rows = await withObservedDrops(sql, limit);
      return json({ mode: "observed_price_drops", rows });
    } catch {
      const rows = await fallbackFromSets(sql, limit);
      return json({ mode: "sets_rrp_fallback", rows });
    }
  } catch (error) {
    return json({ error: "Failed to load price drops", detail: String(error.message || error) }, { status: 500 });
  }
}

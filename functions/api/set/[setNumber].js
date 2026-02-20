import { getSql, json } from "../../_lib/db.js";
import { normalizeSet } from "../../_lib/sets.js";

export async function onRequestGet(context) {
  try {
    const setNumber = String(context.params.setNumber || "").trim();
    if (!setNumber) {
      return json({ error: "setNumber is required" }, { status: 400 });
    }

    const sql = getSql(context);
    const rows = await sql`
      select
        s.set_number,
        s.name as title,
        s.pieces,
        s.release_year,
        s.theme,
        s.rrp_gbp,
        s.image_thumb_url,
        s.image_box_url,
        s.image_hero_url,
        s.variant
      from core.sets s
      where s.set_number = ${setNumber}
      order by s.variant asc
      limit 1
    `;

    if (!rows.length) {
      return json({ error: "Set not found" }, { status: 404 });
    }

    const set = normalizeSet(rows[0]);
    const retailerRows = await sql`
      select
        c.retailer_key,
        coalesce(r.display_name, c.retailer_key) as retailer,
        c.product_url,
        c.price_gbp,
        c.stock_state,
        case
          when c.price_gbp is null or s.rrp_gbp is null or s.rrp_gbp = 0 then null
          else round(((c.price_gbp - s.rrp_gbp) / s.rrp_gbp) * 100.0, 1)
        end as pct_vs_rrp
      from core.set_retailer_current c
      join core.sets s
        on s.set_number = c.set_number
       and s.variant = c.variant
      left join core.retailers r
        on r.retailer_key = c.retailer_key
      where c.set_number = ${set.set_number}
        and c.variant = ${set.variant ?? 0}
        and nullif(trim(c.product_url), '') is not null
      order by retailer asc
    `;

    return json({ set, retailers: retailerRows });
  } catch (error) {
    return json({ error: "Failed to load set", detail: String(error.message || error) }, { status: 500 });
  }
}

import { getSql, json } from "../../_lib/db.js";
import { normalizeSet } from "../../_lib/sets.js";
import { buildMarketplaceRows, buildRetailerRows } from "../../_lib/retail.js";

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
        s.title,
        s.piece_count,
        s.release_date,
        s.theme_name,
        s.rrp_gbp,
        s.image_thumb_url,
        s.image_box_url,
        s.image_hero_url,
        s.variant,
        r.last_updated as last_checked
      from sets s
      left join retail_snapshot r
        on r.set_number = s.set_number
       and r.variant = s.variant
      where s.set_number = ${setNumber}
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

    if (!rows.length) {
      return json({ error: "Set not found" }, { status: 404 });
    }

    const selected = rows[0];
    const set = normalizeSet(selected);
    const retailRows = await sql`
      select
        *
      from retail_snapshot
      where set_number = ${set.set_number}
        and variant = ${set.variant ?? 1}
      limit 1
    `;
    const retailSnapshot = retailRows[0] || null;
    const secondaryRows = await sql`
      select
        bl_new_lowest_ask_gbp
      from secondary_snapshot
      where set_number = ${set.set_number}
        and variant = ${set.variant ?? 1}
      limit 1
    `;
    const secondarySnapshot = secondaryRows[0] || null;
    const retailerRows = [
      ...buildRetailerRows(retailSnapshot, set.rrp_gbp),
      ...buildMarketplaceRows(set.set_number, retailSnapshot, secondarySnapshot, set.rrp_gbp),
    ];

    return json({
      set,
      retailers: retailerRows,
      last_checked: selected.last_checked || retailSnapshot?.last_updated || null,
      tracking_since: null,
      selected_variant: set.variant ?? 1,
    });
  } catch (error) {
    return json({ error: "Failed to load set", detail: String(error.message || error) }, { status: 500 });
  }
}

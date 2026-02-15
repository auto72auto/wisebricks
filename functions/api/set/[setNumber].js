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
        s.variant
      from core.sets s
      where s.set_number = ${setNumber}
      order by s.variant asc
      limit 1
    `;

    if (!rows.length) {
      return json({ error: "Set not found" }, { status: 404 });
    }

    return json({ set: normalizeSet(rows[0]) });
  } catch (error) {
    return json({ error: "Failed to load set", detail: String(error.message || error) }, { status: 500 });
  }
}

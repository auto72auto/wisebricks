import { getSql, json } from "../_lib/db.js";
import { parsePositiveInt } from "../_lib/sets.js";

export async function onRequestGet(context) {
  try {
    const sql = getSql(context);
    const url = new URL(context.request.url);
    const limit = parsePositiveInt(url.searchParams.get("limit"), 12);

    const rows = await sql`
      select
        coalesce(nullif(trim(theme), ''), 'Unknown') as theme,
        count(*)::int as set_count,
        min(release_year) as first_year,
        max(release_year) as latest_year,
        round(avg(pieces)::numeric, 1) as avg_pieces
      from core.sets
      group by coalesce(nullif(trim(theme), ''), 'Unknown')
      order by set_count desc, theme asc
      limit ${limit}
    `;

    return json({ themes: rows });
  } catch (error) {
    return json({ error: "Failed to load themes", detail: String(error.message || error) }, { status: 500 });
  }
}

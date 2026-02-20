import { getSql, json } from "../_lib/db.js";
import { normalizeSet, parsePositiveInt } from "../_lib/sets.js";

function normalizeQuery(query) {
  return String(query || "").trim();
}

export async function onRequestGet(context) {
  try {
    const sql = getSql(context);
    const url = new URL(context.request.url);
    const q = normalizeQuery(url.searchParams.get("q"));
    const limit = parsePositiveInt(url.searchParams.get("limit"), 24);

    let rows = [];
    if (!q) {
      rows = await sql`
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
        order by s.set_number asc, s.variant asc
        limit ${limit}
      `;
    } else {
      const like = `%${q}%`;
      rows = await sql`
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
          s.variant,
          case
            when s.set_number = ${q} then 0
            when s.set_number ilike ${like} then 1
            when s.name ilike ${like} then 2
            when coalesce(s.theme, '') ilike ${like} then 3
            else 4
          end as rank
        from core.sets s
        where s.set_number ilike ${like}
           or s.name ilike ${like}
           or coalesce(s.theme, '') ilike ${like}
        order by rank asc, s.set_number asc, s.variant asc
        limit ${limit}
      `;
    }

    const results = rows.map((r) => normalizeSet(r));
    return json({ query: q, count: results.length, results });
  } catch (error) {
    return json({ error: "Failed to query sets", detail: String(error.message || error) }, { status: 500 });
  }
}

import { getSql, json } from "../_lib/db.js";
import { normalizeSet, parsePositiveInt } from "../_lib/sets.js";

function normalizeQuery(query) {
  return String(query || "").trim();
}

function parseNonNegativeInt(value, fallback) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function parseThemeList(value) {
  const raw = String(value || "").trim();
  if (!raw) return [];
  return [...new Set(raw.split(",").map((item) => item.trim()).filter(Boolean))];
}

export async function onRequestGet(context) {
  try {
    const sql = getSql(context);
    const url = new URL(context.request.url);
    const q = normalizeQuery(url.searchParams.get("q"));
    const limit = parsePositiveInt(url.searchParams.get("limit"), 36);
    const offset = parseNonNegativeInt(url.searchParams.get("offset"), 0);
    const themes = parseThemeList(url.searchParams.get("themes"));
    const hasThemes = themes.length > 0;

    let rows = [];
    let totalRows = [];
    if (!q && !hasThemes) {
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
        offset ${offset}
      `;
      totalRows = await sql`select count(*)::int as total_count from core.sets`;
    } else if (!q && hasThemes) {
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
        where coalesce(nullif(trim(s.theme), ''), 'Unknown') = any(${themes})
        order by s.set_number asc, s.variant asc
        limit ${limit}
        offset ${offset}
      `;
      totalRows = await sql`
        select count(*)::int as total_count
        from core.sets s
        where coalesce(nullif(trim(s.theme), ''), 'Unknown') = any(${themes})
      `;
    } else {
      const like = `%${q}%`;
      if (hasThemes) {
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
          where (
            s.set_number ilike ${like}
            or s.name ilike ${like}
            or coalesce(s.theme, '') ilike ${like}
          )
            and coalesce(nullif(trim(s.theme), ''), 'Unknown') = any(${themes})
          order by rank asc, s.set_number asc, s.variant asc
          limit ${limit}
          offset ${offset}
        `;
        totalRows = await sql`
          select count(*)::int as total_count
          from core.sets s
          where (
            s.set_number ilike ${like}
            or s.name ilike ${like}
            or coalesce(s.theme, '') ilike ${like}
          )
            and coalesce(nullif(trim(s.theme), ''), 'Unknown') = any(${themes})
        `;
      } else {
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
          offset ${offset}
        `;
        totalRows = await sql`
          select count(*)::int as total_count
          from core.sets s
          where s.set_number ilike ${like}
             or s.name ilike ${like}
             or coalesce(s.theme, '') ilike ${like}
        `;
      }
    }

    const results = rows.map((r) => normalizeSet(r));
    const totalCount = Number(totalRows?.[0]?.total_count || 0);
    return json({ query: q, offset, limit, count: results.length, total_count: totalCount, results, themes });
  } catch (error) {
    return json({ error: "Failed to query sets", detail: String(error.message || error) }, { status: 500 });
  }
}

import { getSql, json } from "../_lib/db.js";
import { normalizeSet, parsePositiveInt } from "../_lib/sets.js";

function normalizeQuery(query) {
  return String(query || "").trim();
}

function parseNonNegativeInt(value, fallback) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function parseListParam(value) {
  const raw = String(value || "").trim();
  if (!raw) return [];
  return [...new Set(raw.split(",").map((item) => item.trim()).filter(Boolean))];
}

function parseSortBy(value) {
  const allowed = new Set(["set_number", "title", "price"]);
  return allowed.has(value) ? value : "set_number";
}

function parseSortDir(value) {
  return value === "desc" ? "desc" : "asc";
}

export async function onRequestGet(context) {
  try {
    const sql = getSql(context);
    const url = new URL(context.request.url);
    const q = normalizeQuery(url.searchParams.get("q"));
    const like = `%${q}%`;
    const limit = parsePositiveInt(url.searchParams.get("limit"), 36);
    const offset = parseNonNegativeInt(url.searchParams.get("offset"), 0);
    const themes = parseListParam(url.searchParams.get("themes"));
    const hasThemes = themes.length > 0;

    const priceBuckets = parseListParam(url.searchParams.get("price_buckets"));
    const hasPriceBuckets = priceBuckets.length > 0;
    const includeUnder25 = priceBuckets.includes("under_25");
    const include25to50 = priceBuckets.includes("from_25_to_50");
    const include50to100 = priceBuckets.includes("from_50_to_100");
    const include100to200 = priceBuckets.includes("from_100_to_200");
    const includeOver200 = priceBuckets.includes("over_200");
    const includeNoPrice = priceBuckets.includes("no_price");

    const sortBy = parseSortBy(url.searchParams.get("sort_by"));
    const sortDir = parseSortDir(url.searchParams.get("sort_dir"));

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
      where (
        ${q === ""}
        or s.set_number ilike ${like}
        or s.name ilike ${like}
        or coalesce(s.theme, '') ilike ${like}
      )
        and (
          ${hasThemes === false}
          or coalesce(nullif(trim(s.theme), ''), 'Unknown') = any(${themes})
        )
        and (
          ${hasPriceBuckets === false}
          or (
            (${includeUnder25} and s.rrp_gbp is not null and s.rrp_gbp < 25)
            or (${include25to50} and s.rrp_gbp is not null and s.rrp_gbp >= 25 and s.rrp_gbp < 50)
            or (${include50to100} and s.rrp_gbp is not null and s.rrp_gbp >= 50 and s.rrp_gbp < 100)
            or (${include100to200} and s.rrp_gbp is not null and s.rrp_gbp >= 100 and s.rrp_gbp < 200)
            or (${includeOver200} and s.rrp_gbp is not null and s.rrp_gbp >= 200)
            or (${includeNoPrice} and s.rrp_gbp is null)
          )
        )
      order by
        case when ${sortBy} = 'price' and ${sortDir} = 'asc' then s.rrp_gbp end asc nulls last,
        case when ${sortBy} = 'price' and ${sortDir} = 'desc' then s.rrp_gbp end desc nulls last,
        case when ${sortBy} = 'set_number' and ${sortDir} = 'asc' then s.set_number end asc,
        case when ${sortBy} = 'set_number' and ${sortDir} = 'desc' then s.set_number end desc,
        case when ${sortBy} = 'title' and ${sortDir} = 'asc' then s.name end asc,
        case when ${sortBy} = 'title' and ${sortDir} = 'desc' then s.name end desc,
        s.set_number asc,
        s.variant asc
      limit ${limit}
      offset ${offset}
    `;

    const totalRows = await sql`
      select count(*)::int as total_count
      from core.sets s
      where (
        ${q === ""}
        or s.set_number ilike ${like}
        or s.name ilike ${like}
        or coalesce(s.theme, '') ilike ${like}
      )
        and (
          ${hasThemes === false}
          or coalesce(nullif(trim(s.theme), ''), 'Unknown') = any(${themes})
        )
        and (
          ${hasPriceBuckets === false}
          or (
            (${includeUnder25} and s.rrp_gbp is not null and s.rrp_gbp < 25)
            or (${include25to50} and s.rrp_gbp is not null and s.rrp_gbp >= 25 and s.rrp_gbp < 50)
            or (${include50to100} and s.rrp_gbp is not null and s.rrp_gbp >= 50 and s.rrp_gbp < 100)
            or (${include100to200} and s.rrp_gbp is not null and s.rrp_gbp >= 100 and s.rrp_gbp < 200)
            or (${includeOver200} and s.rrp_gbp is not null and s.rrp_gbp >= 200)
            or (${includeNoPrice} and s.rrp_gbp is null)
          )
        )
    `;

    const results = rows.map((r) => normalizeSet(r));
    const totalCount = Number(totalRows?.[0]?.total_count || 0);
    return json({
      query: q,
      offset,
      limit,
      count: results.length,
      total_count: totalCount,
      results,
      themes,
      price_buckets: priceBuckets,
      sort_by: sortBy,
      sort_dir: sortDir,
    });
  } catch (error) {
    return json({ error: "Failed to query sets", detail: String(error.message || error) }, { status: 500 });
  }
}

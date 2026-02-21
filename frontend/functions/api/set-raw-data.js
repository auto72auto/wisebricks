import { getSql, json } from "../_lib/db.js";
import { normalizeSet, parsePositiveInt } from "../_lib/sets.js";

function parseBoundedPositiveInt(value, fallback, max) {
  const parsed = parsePositiveInt(value, fallback);
  return Math.min(parsed, max);
}

function toNum(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toIsoOrNull(value) {
  if (!value) return null;
  const dt = new Date(value);
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString();
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const requestedSetNumber = String(
    url.searchParams.get("set") || url.searchParams.get("set_number") || ""
  ).trim();
  const comparablesLimit = parseBoundedPositiveInt(
    url.searchParams.get("comparables_limit"),
    6,
    20
  );
  const historyWeeks = parseBoundedPositiveInt(
    url.searchParams.get("history_weeks"),
    26,
    104
  );

  if (!requestedSetNumber) {
    return json({ error: "set query parameter is required" }, { status: 400 });
  }

  try {
    const sql = getSql(context);

    const setRows = await sql`
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
      where s.set_number = ${requestedSetNumber}
      order by s.variant asc
      limit 1
    `;

    if (!setRows.length) {
      return json({ error: "Set not found" }, { status: 404 });
    }

    const set = normalizeSet(setRows[0]);
    const setVariant = set.variant ?? 0;
    const targetRrp = toNum(set.rrp_gbp);
    const targetPieces = Number.isFinite(set.pieces) ? set.pieces : null;
    const targetYear = Number.isFinite(set.release_year) ? set.release_year : null;
    const targetTheme = set.theme || null;
    const minComparableRrp = targetRrp === null ? null : targetRrp * 0.6;
    const maxComparableRrp = targetRrp === null ? null : targetRrp * 1.4;

    const currentRetailers = await sql`
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
        and c.variant = ${setVariant}
      order by retailer asc
    `;

    let weeklyHistory = [];
    let historyMode = "ok";
    try {
      weeklyHistory = await sql`
        with weekly as (
          select
            date_trunc('week', o.observed_at)::date as week_start,
            avg(o.price_gbp) as avg_price_gbp,
            min(o.price_gbp) as min_price_gbp,
            max(o.price_gbp) as max_price_gbp,
            count(*)::int as observation_count
          from core.set_retailer_observation o
          where o.set_number = ${set.set_number}
            and o.variant = ${setVariant}
            and o.price_gbp is not null
          group by date_trunc('week', o.observed_at)::date
          order by week_start desc
          limit ${historyWeeks}
        )
        select
          week_start,
          round(avg_price_gbp::numeric, 2) as avg_price_gbp,
          round(min_price_gbp::numeric, 2) as min_price_gbp,
          round(max_price_gbp::numeric, 2) as max_price_gbp,
          observation_count
        from weekly
        order by week_start asc
      `;
    } catch {
      historyMode = "unavailable";
      weeklyHistory = [];
    }

    let comparables = [];
    let comparablesMode = "ok";
    try {
      comparables = await sql`
        select
          s.set_number,
          s.name as title,
          s.theme,
          s.release_year,
          s.pieces,
          s.rrp_gbp,
          cheapest.price_gbp as best_current_price_gbp,
          cheapest.retailer as best_price_retailer,
          case
            when cheapest.price_gbp is null or s.rrp_gbp is null or s.rrp_gbp = 0 then null
            else round(((cheapest.price_gbp - s.rrp_gbp) / s.rrp_gbp) * 100.0, 1)
          end as best_price_pct_vs_rrp,
          obs.latest_observed_at,
          obs.last_7d_avg_price_gbp
        from core.sets s
        left join lateral (
          select
            c.price_gbp,
            coalesce(r.display_name, c.retailer_key) as retailer
          from core.set_retailer_current c
          left join core.retailers r
            on r.retailer_key = c.retailer_key
          where c.set_number = s.set_number
            and c.variant = s.variant
            and c.price_gbp is not null
          order by c.price_gbp asc
          limit 1
        ) cheapest on true
        left join lateral (
          select
            max(o.observed_at) as latest_observed_at,
            round(avg(o.price_gbp)::numeric, 2) filter (
              where o.observed_at >= now() - interval '7 day'
            ) as last_7d_avg_price_gbp
          from core.set_retailer_observation o
          where o.set_number = s.set_number
            and o.variant = s.variant
            and o.price_gbp is not null
        ) obs on true
        where s.set_number <> ${set.set_number}
          and (${targetTheme === null} or s.theme = ${targetTheme})
          and (
            ${targetRrp === null}
            or (
              s.rrp_gbp is not null
              and s.rrp_gbp between ${minComparableRrp} and ${maxComparableRrp}
            )
          )
        order by
          (
            case
              when ${targetRrp === null || targetRrp === 0} then 0
              when s.rrp_gbp is null then 10
              else abs(s.rrp_gbp - ${targetRrp}) / ${targetRrp}
            end
            +
            case
              when ${targetPieces === null || targetPieces === 0} then 0
              when s.pieces is null then 1
              else abs(s.pieces - ${targetPieces})::numeric / ${targetPieces}
            end
            +
            case
              when ${targetYear === null} then 0
              when s.release_year is null then 1
              else abs(s.release_year - ${targetYear})::numeric / 10
            end
          ) asc,
          s.set_number asc
        limit ${comparablesLimit}
      `;
    } catch {
      comparablesMode = "unavailable";
      comparables = [];
    }

    const snapshot = {
      retailer_count: currentRetailers.length,
      lowest_current_price_gbp: currentRetailers
        .map((row) => toNum(row.price_gbp))
        .filter((v) => v !== null)
        .sort((a, b) => a - b)[0] ?? null,
      highest_current_price_gbp: currentRetailers
        .map((row) => toNum(row.price_gbp))
        .filter((v) => v !== null)
        .sort((a, b) => b - a)[0] ?? null,
      latest_observation_at: toIsoOrNull(
        weeklyHistory.length ? weeklyHistory[weeklyHistory.length - 1].week_start : null
      ),
    };

    return json({
      generated_at: new Date().toISOString(),
      requested_set_number: requestedSetNumber,
      set,
      set_facts: {
        price_per_piece_gbp:
          targetRrp === null || !targetPieces || targetPieces <= 0
            ? null
            : Number((targetRrp / targetPieces).toFixed(4)),
      },
      snapshot,
      retailers: currentRetailers,
      history: {
        mode: historyMode,
        weeks_requested: historyWeeks,
        points: weeklyHistory,
      },
      comparables: {
        mode: comparablesMode,
        limit: comparablesLimit,
        results: comparables,
      },
    });
  } catch (error) {
    return json(
      { error: "Failed to load review data", detail: String(error.message || error) },
      { status: 500 }
    );
  }
}

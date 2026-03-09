function nonEmpty(value) {
  return value !== null && value !== undefined && `${value}`.trim() !== "";
}

function first(obj, keys) {
  for (const key of keys) {
    if (nonEmpty(obj[key])) return obj[key];
  }
  return null;
}

function toInt(value) {
  if (!nonEmpty(value)) return null;
  const parsed = Number.parseInt(String(value).replace(/[^0-9-]/g, ""), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function toNum(value) {
  if (!nonEmpty(value)) return null;
  const parsed = Number.parseFloat(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeSet(raw) {
  const releaseDate = first(raw, ["release_date"]);
  const releaseYear =
    toInt(first(raw, ["release_year"])) ??
    (releaseDate ? new Date(releaseDate).getUTCFullYear() : null);

  return {
    set_number: first(raw, ["set_number"]),
    title: first(raw, ["title", "name"]) || "Untitled set",
    pieces: toInt(first(raw, ["piece_count", "pieces"])),
    release_year: Number.isFinite(releaseYear) ? releaseYear : null,
    release_date: releaseDate || null,
    theme: first(raw, ["theme_name", "theme", "theme_group"]),
    subtheme: first(raw, ["subtheme_name", "subtheme"]),
    rrp_gbp: toNum(first(raw, ["rrp_gbp"])),
    image_thumb_url: first(raw, ["image_thumb_url"]),
    image_box_url: first(raw, ["image_box_url"]),
    image_hero_url: first(raw, ["image_hero_url"]),
    variant: toInt(first(raw, ["variant"])),
  };
}

export function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

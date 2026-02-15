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
  return {
    set_number: first(raw, ["set_number"]),
    title: first(raw, ["title", "name"]) || "Untitled set",
    pieces: toInt(first(raw, ["pieces"])),
    release_year: toInt(first(raw, ["release_year"])),
    theme: first(raw, ["theme", "theme_group"]),
    rrp_gbp: toNum(first(raw, ["rrp_gbp"])),
    variant: toInt(first(raw, ["variant"])),
  };
}

export function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

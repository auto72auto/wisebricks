export async function apiGet(path) {
  const response = await fetch(path, { headers: { accept: "application/json" } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `Request failed: ${response.status}`);
  }
  return payload;
}

export function fmtInt(value) {
  if (value === null || value === undefined || value === "") return "Unavailable";
  const n = Number(value);
  if (!Number.isFinite(n)) return "Unavailable";
  return n.toLocaleString("en-GB");
}

export function fmtYear(value) {
  if (value === null || value === undefined || value === "") return "Unavailable";
  return String(value);
}

export function fmtGbp(value) {
  if (value === null || value === undefined || value === "") return "Unavailable";
  const n = Number(value);
  if (!Number.isFinite(n)) return "Unavailable";
  return `£${n.toFixed(2)}`;
}

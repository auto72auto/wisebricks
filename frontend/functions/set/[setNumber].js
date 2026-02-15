export async function onRequestGet(context) {
  const setNumber = String(context.params.setNumber || "").trim();
  if (!setNumber) {
    return Response.redirect(new URL("/search-results.html", context.request.url), 302);
  }

  const target = new URL(`/set-page.html?set=${encodeURIComponent(setNumber)}`, context.request.url);
  return Response.redirect(target, 302);
}

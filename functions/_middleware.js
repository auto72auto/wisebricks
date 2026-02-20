export async function onRequest(context) {
  const url = new URL(context.request.url);

  if (url.hostname === "wisebricks.pages.dev") {
    url.hostname = "wisebricks.co.uk";
    return Response.redirect(url.toString(), 301);
  }

  return context.next();
}

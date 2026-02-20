export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.hostname === "wisebricks.pages.dev") {
      url.hostname = "wisebricks.co.uk";
      return Response.redirect(url.toString(), 301);
    }

    return env.ASSETS.fetch(request);
  },
};

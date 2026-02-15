import { neon } from "@neondatabase/serverless";

let sqlClient;
let cachedUrl;

export function getSql(context) {
  const databaseUrl = context.env.DATABASE_URL || context.env.NEON_DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL or NEON_DATABASE_URL is required.");
  }

  if (!sqlClient || cachedUrl !== databaseUrl) {
    sqlClient = neon(databaseUrl);
    cachedUrl = databaseUrl;
  }

  return sqlClient;
}

export function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...init.headers,
    },
    ...init,
  });
}

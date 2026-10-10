import { betterAuth } from "better-auth";
import { nextCookies, toNextJsHandler } from "better-auth/next-js";
import { getMigrations } from "better-auth/db/migration";
import { LibsqlDialect } from "kysely-libsql";

import { ensureAppSchema } from "./db";

const dbUrl = process.env.TURSO_DATABASE_URL ?? "file:filebase-server.db";

if (process.env.NODE_ENV === "production" && !process.env.BETTER_AUTH_SECRET) {
  throw new Error(
    "BETTER_AUTH_SECRET is required in production. Set it in the environment (see .env.example)."
  );
}

export const auth = betterAuth({
  // { dialect, type } is auto-detected and wrapped in Kysely internally.
  database: {
    dialect: new LibsqlDialect({
      url: dbUrl,
      authToken: process.env.TURSO_AUTH_TOKEN,
    }),
    type: "sqlite" as const,
  },
  secret: process.env.BETTER_AUTH_SECRET,
  emailAndPassword: {
    enabled: true,
  },
  plugins: [nextCookies()],
});

let ready: Promise<void> | null = null;

/**
 * One-time server bootstrap: app tables + Better Auth tables. Memoized so
 * concurrent requests share a single run.
 */
export function ensureServer(): Promise<void> {
  ready ??= (async () => {
    await ensureAppSchema();
    const { runMigrations } = await getMigrations(auth.options);
    await runMigrations();
  })();
  return ready;
}

export { toNextJsHandler };

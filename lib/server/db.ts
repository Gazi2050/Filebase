import { createClient, type Client } from "@libsql/client";

// Env-driven: Turso when configured, otherwise a local libsql file for dev.
const url = process.env.TURSO_DATABASE_URL ?? "file:filebase-server.db";

let client: Client | null = null;

export function getDb(): Client {
  client ??= createClient({
    url,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  return client;
}

let schemaReady: Promise<void> | null = null;

/** Idempotent creation of the app-owned tables (files, contents, tombstones). */
export function ensureAppSchema(): Promise<void> {
  schemaReady ??= (async () => {
    const db = getDb();
    await db.batch(
      [
        {
          sql: `CREATE TABLE IF NOT EXISTS files (
            id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            name TEXT NOT NULL,
            type TEXT NOT NULL,
            parent_id TEXT,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            PRIMARY KEY (id, user_id)
          )`,
          args: [],
        },
        {
          sql: "CREATE INDEX IF NOT EXISTS files_user_idx ON files (user_id, updated_at)",
          args: [],
        },
        {
          sql: `CREATE TABLE IF NOT EXISTS file_contents (
            file_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            content TEXT NOT NULL,
            updated_at INTEGER NOT NULL,
            PRIMARY KEY (file_id, user_id)
          )`,
          args: [],
        },
        {
          sql: "CREATE INDEX IF NOT EXISTS file_contents_user_idx ON file_contents (user_id, updated_at)",
          args: [],
        },
        {
          sql: `CREATE TABLE IF NOT EXISTS deletions (
            id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            deleted_at INTEGER NOT NULL,
            PRIMARY KEY (id, user_id)
          )`,
          args: [],
        },
        {
          sql: "CREATE INDEX IF NOT EXISTS deletions_user_idx ON deletions (user_id, deleted_at)",
          args: [],
        },
        {
          sql: `CREATE TABLE IF NOT EXISTS shares (
            id TEXT PRIMARY KEY,
            file_id TEXT NOT NULL,
            owner_id TEXT NOT NULL,
            token TEXT NOT NULL UNIQUE,
            permission TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            revoked_at INTEGER
          )`,
          args: [],
        },
        {
          sql: "CREATE INDEX IF NOT EXISTS shares_file_idx ON shares (file_id, owner_id)",
          args: [],
        },
      ],
      "write"
    );
  })();
  return schemaReady;
}

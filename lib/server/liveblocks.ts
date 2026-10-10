import { Liveblocks } from "@liveblocks/node";

let client: Liveblocks | null = null;

/** Server Liveblocks client. Fails fast with a setup hint instead of a cryptic 401 later. */
export function getLiveblocks(): Liveblocks {
  const secret = process.env.LB_SK;
  if (!secret) {
    throw new Error(
      "Liveblocks is not configured: set LB_SK in .env.local (server secret, never public)."
    );
  }
  client ??= new Liveblocks({ secret });
  return client;
}

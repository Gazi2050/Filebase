import { randomUUID } from "node:crypto";

import { auth, ensureServer } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";
import { getLiveblocks } from "@/lib/server/liveblocks";
import {
  isShareTokenFormat,
  roomIdForFile,
  sanitizeGuestName,
} from "@/lib/share-links";

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const GUEST_ID = /^[A-Za-z0-9_-]{1,64}$/;
const AVATAR_COLORS = [
  "#7c3aed",
  "#2563eb",
  "#059669",
  "#ea580c",
  "#db2777",
  "#0891b2",
  "#65a30d",
  "#b45309",
];

function colorFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

const forbidden = () => Response.json({ error: "forbidden" }, { status: 403 });

/**
 * Liveblocks access-token endpoint. The share token is a bearer credential:
 * it decides WHICH room and WHETHER read or write. The signed-in platform
 * identity is used when present; otherwise a sanitized guest profile.
 * Nothing client-supplied ever grants more than the share record allows.
 */
export async function POST(req: Request) {
  await ensureServer();
  const body = (await req.json().catch(() => null)) as {
    room?: unknown;
    token?: unknown;
    guest?: { id?: unknown; name?: unknown; color?: unknown };
  } | null;

  const token = typeof body?.token === "string" ? body.token : "";
  if (!isShareTokenFormat(token)) return forbidden();

  const db = getDb();
  const rows = await db.execute({
    sql: "SELECT file_id, owner_id, permission FROM shares WHERE token = ? AND revoked_at IS NULL",
    args: [token],
  });
  const share = rows.rows[0] as Record<string, unknown> | undefined;
  if (!share) return forbidden();

  const room = typeof body?.room === "string" ? body.room : "";
  if (room !== roomIdForFile(share.file_id as string)) return forbidden();

  const session = await auth.api.getSession({ headers: req.headers });

  let userId: string;
  let userInfo: Record<string, string>;
  if (session?.user) {
    userId = session.user.id;
    const name =
      sanitizeGuestName(session.user.name) !== "Guest"
        ? sanitizeGuestName(session.user.name)
        : sanitizeGuestName(session.user.email?.split("@")[0]);
    userInfo = { name, color: colorFor(userId) };
    if (session.user.image) userInfo.avatar = session.user.image;
  } else {
    const rawId = body?.guest?.id;
    const guestId = typeof rawId === "string" && GUEST_ID.test(rawId) ? rawId : randomUUID();
    userId = `guest-${guestId}`;
    const rawColor = body?.guest?.color;
    userInfo = {
      name: sanitizeGuestName(body?.guest?.name),
      color:
        typeof rawColor === "string" && HEX_COLOR.test(rawColor)
          ? rawColor
          : colorFor(userId),
    };
  }

  try {
    const liveblocks = getLiveblocks();
    const lbSession = liveblocks.prepareSession(userId, { userInfo });
    if (share.permission === "write") {
      lbSession.allow(room, lbSession.FULL_ACCESS);
    } else {
      lbSession.allow(room, ["*:read"]);
    }
    const { status, body: authBody } = await lbSession.authorize();
    return new Response(authBody, { status });
  } catch {
    return Response.json({ error: "collaboration unavailable" }, { status: 503 });
  }
}

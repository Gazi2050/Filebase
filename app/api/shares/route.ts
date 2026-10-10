import { auth, ensureServer } from "@/lib/server/auth";
import { createShare, listShares, ShareError } from "@/lib/server/shares";

async function ownerId(req: Request): Promise<string | null> {
  const session = await auth.api.getSession({ headers: req.headers });
  return session?.user?.id ?? null;
}

export async function GET(req: Request) {
  await ensureServer();
  const userId = await ownerId(req);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const fileId = new URL(req.url).searchParams.get("fileId") ?? "";
  try {
    const shares = await listShares(userId, fileId);
    return Response.json({ shares });
  } catch (e) {
    if (e instanceof ShareError) {
      return Response.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}

export async function POST(req: Request) {
  await ensureServer();
  const userId = await ownerId(req);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as {
    fileId?: unknown;
    permission?: unknown;
  } | null;
  if (typeof body?.fileId !== "string" || body.fileId === "") {
    return Response.json({ error: "fileId is required" }, { status: 400 });
  }
  try {
    const share = await createShare(userId, body.fileId, body.permission);
    return Response.json({ share }, { status: 201 });
  } catch (e) {
    if (e instanceof ShareError) {
      return Response.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}

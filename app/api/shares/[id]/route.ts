import { auth, ensureServer } from "@/lib/server/auth";
import { revokeShare, setSharePermission, ShareError } from "@/lib/server/shares";

async function ownerId(req: Request): Promise<string | null> {
  const session = await auth.api.getSession({ headers: req.headers });
  return session?.user?.id ?? null;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureServer();
  const userId = await ownerId(req);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as {
    permission?: unknown;
  } | null;
  try {
    const share = await setSharePermission(userId, id, body?.permission);
    return Response.json({ share });
  } catch (e) {
    if (e instanceof ShareError) {
      return Response.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureServer();
  const userId = await ownerId(req);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    await revokeShare(userId, id);
    return Response.json({ ok: true });
  } catch (e) {
    if (e instanceof ShareError) {
      return Response.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}

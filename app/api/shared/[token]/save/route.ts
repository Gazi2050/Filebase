import { ensureServer } from "@/lib/server/auth";
import { saveSharedContent, ShareError } from "@/lib/server/shares";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  await ensureServer();
  const { token } = await params;
  const body = (await req.json().catch(() => null)) as {
    content?: unknown;
    baseUpdatedAt?: unknown;
  } | null;
  try {
    const result = await saveSharedContent(token, body?.content, body?.baseUpdatedAt);
    if ("conflict" in result) {
      return Response.json(
        { error: "newer version exists", currentUpdatedAt: result.currentUpdatedAt },
        { status: 409 }
      );
    }
    return Response.json({ ok: true, updatedAt: result.updatedAt });
  } catch (e) {
    if (e instanceof ShareError) {
      return Response.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}

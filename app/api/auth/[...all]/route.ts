import { auth, ensureServer } from "@/lib/server/auth";
import { toNextJsHandler } from "better-auth/next-js";

const handlers = toNextJsHandler(auth);

export async function GET(req: Request) {
  await ensureServer();
  return handlers.GET(req);
}

export async function POST(req: Request) {
  await ensureServer();
  return handlers.POST(req);
}

import { headers } from "next/headers";
import Link from "next/link";

import { SharedEditorClient } from "@/components/share/shared-editor-client";
import { auth } from "@/lib/server/auth";
import { resolveShareToken } from "@/lib/server/shares";
import { sanitizeGuestName } from "@/lib/share-links";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const resolution = await resolveShareToken(token);
  return {
    title:
      resolution.kind === "ok"
        ? `${resolution.snapshot.fileName} — Filebase`
        : "Shared document — Filebase",
  };
}

function ShareNotice({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-3 bg-background px-6 text-center">
      <span className="text-xs font-semibold tracking-wider text-muted-foreground">
        FILEBASE
      </span>
      <h1 className="text-xl font-semibold">{title}</h1>
      <div className="max-w-sm text-sm text-muted-foreground">{children}</div>
      <Link
        href="/"
        className="mt-2 rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
      >
        Open Filebase
      </Link>
    </div>
  );
}

export default async function SharedPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const resolution = await resolveShareToken(token);

  if (resolution.kind === "invalid") {
    return (
      <ShareNotice title="This link doesn’t work">
        <p>
          The link is invalid or was revoked by the owner. Ask them for a
          fresh one.
        </p>
      </ShareNotice>
    );
  }

  if (resolution.kind === "gone") {
    return (
      <ShareNotice title="This file was deleted">
        <p>The owner deleted the file this link pointed to.</p>
      </ShareNotice>
    );
  }

  let platformUser: { name: string; avatar?: string } | null = null;
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (session?.user) {
      platformUser = {
        name: sanitizeGuestName(
          session.user.name && session.user.name !== ""
            ? session.user.name
            : (session.user.email?.split("@")[0] ?? "Member")
        ),
        avatar: session.user.image ?? undefined,
      };
    }
  } catch {
    platformUser = null;
  }

  return (
    <SharedEditorClient
      token={token}
      snapshot={resolution.snapshot}
      platformUser={platformUser}
    />
  );
}

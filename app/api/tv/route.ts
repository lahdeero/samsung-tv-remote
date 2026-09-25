import { NextResponse } from "next/server";

import { executeAction, isTvAction } from "@/lib/tv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const action = (body as { action?: unknown } | null)?.action;
  const key = (body as { key?: unknown } | null)?.key;

  if (!isTvAction(action)) {
    return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  }

  try {
    const output = await executeAction(action, typeof key === "string" ? key : undefined);
    return NextResponse.json({ ok: true, output: output.trim() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "TV command failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

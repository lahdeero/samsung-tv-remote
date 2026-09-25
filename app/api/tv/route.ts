import { NextResponse } from "next/server";

import { executeAction, isTvAction, TvValidationError } from "@/lib/tv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const payload = (body ?? {}) as {
    action?: unknown;
    key?: unknown;
    channel?: unknown;
    text?: unknown;
  };

  if (!isTvAction(payload.action)) {
    return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  }

  try {
    const output = await executeAction(payload.action, {
      key: payload.key,
      channel: payload.channel,
      text: payload.text,
    });
    return NextResponse.json({ ok: true, output: output.trim() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "TV command failed";
    const status = error instanceof TvValidationError ? 400 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

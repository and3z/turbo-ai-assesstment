import { NextResponse } from "next/server";

import { AUTH_COOKIE_NAME, isValidPasscode } from "@/lib/auth";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { passcode?: string } | null;
  const passcode = typeof body?.passcode === "string" ? body.passcode : "";

  if (!isValidPasscode(passcode)) {
    return NextResponse.json(
      { error: "Invalid passcode. Use the shared internal credential." },
      { status: 401 },
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: "1",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });

  return response;
}


import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { AUTH_COOKIE_NAME } from "@/lib/auth";

export async function GET() {
  const cookieStore = await cookies();
  const authenticated = cookieStore.get(AUTH_COOKIE_NAME)?.value === "1";

  return NextResponse.json({ authenticated });
}


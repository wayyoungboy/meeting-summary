import { NextRequest, NextResponse } from "next/server";
import { proxyToFastAPI } from "@/lib/api-proxy";

export async function POST(request: NextRequest) {
  try {
    await proxyToFastAPI(request, "/api/auth/logout", "POST");
  } catch {
    // Logout is local for stateless JWTs; the cookie must still be removed.
  }

  const res = NextResponse.json({ success: true });

  res.cookies.set("token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });

  return res;
}

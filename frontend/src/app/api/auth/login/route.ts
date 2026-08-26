import { NextRequest, NextResponse } from "next/server";
import { getErrorMessage, proxyToFastAPI } from "@/lib/api-proxy";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    if (typeof body.username !== "string" || typeof body.password !== "string") {
      return NextResponse.json(
        { success: false, error: "用户名和密码为必填项" },
        { status: 400 },
      );
    }

    const response = await proxyToFastAPI(
      request,
      "/api/auth/login",
      "POST",
      { username: body.username, password: body.password },
    );

    const data: unknown = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: getErrorMessage(data, "登录失败") },
        { status: response.status },
      );
    }

    const accessToken =
      typeof data === "object" && data !== null
        ? (data as Record<string, unknown>).access_token
        : null;
    if (typeof accessToken !== "string") {
      return NextResponse.json(
        { success: false, error: "认证服务返回了无效响应" },
        { status: 502 },
      );
    }

    const res = NextResponse.json({ success: true });
    res.cookies.set("token", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24,
      path: "/",
    });
    return res;
  } catch {
    return NextResponse.json(
      { success: false, error: "认证服务暂时不可用" },
      { status: 502 },
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getErrorMessage, proxyToFastAPI } from "@/lib/api-proxy";

export async function GET(request: NextRequest) {
  try {
    const response = await proxyToFastAPI(request, "/api/auth/me");

    if (!response.ok) {
      const errorData: unknown = await response.json().catch(() => null);
      return NextResponse.json(
        { success: false, error: getErrorMessage(errorData, "获取用户信息失败") },
        { status: response.status }
      );
    }

    const data: unknown = await response.json();
    const user =
      typeof data === "object" && data !== null &&
      typeof (data as Record<string, unknown>).data === "object"
        ? (data as Record<string, unknown>).data
        : data;
    return NextResponse.json({ success: true, data: user });
  } catch {
    return NextResponse.json(
      { success: false, error: "认证服务暂时不可用" },
      { status: 502 },
    );
  }
}

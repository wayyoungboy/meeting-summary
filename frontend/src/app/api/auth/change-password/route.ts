import { NextRequest, NextResponse } from "next/server";
import { getErrorMessage, proxyToFastAPI } from "@/lib/api-proxy";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const { oldPassword, newPassword } = body;

    if (typeof oldPassword !== "string" || typeof newPassword !== "string") {
      return NextResponse.json(
        { success: false, error: "旧密码和新密码为必填项" },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { success: false, error: "新密码长度至少8位" },
        { status: 400 }
      );
    }

    const response = await proxyToFastAPI(
      request,
      "/api/auth/change-password",
      "POST",
      { oldPassword, newPassword },
    );
    const data: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: getErrorMessage(data, "修改密码失败") },
        { status: response.status },
      );
    }

    return NextResponse.json({
      success: true,
      message: "密码修改成功",
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "认证服务暂时不可用" },
      { status: 502 },
    );
  }
}

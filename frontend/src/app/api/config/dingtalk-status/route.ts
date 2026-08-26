import { NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/api-proxy";

// 检查钉钉 Webhook 是否已配置（公开接口）
export async function GET() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/config/dingtalk-status`, {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });

    if (response.ok) {
      const data = await response.json();
      return NextResponse.json({ success: true, data });
    }

    return NextResponse.json(
      { success: false, error: "获取配置失败" },
      { status: response.status }
    );
  } catch {
    return NextResponse.json({ success: false, error: "后端服务暂时不可用" }, { status: 502 });
  }
}

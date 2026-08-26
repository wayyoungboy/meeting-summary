import { NextRequest, NextResponse } from "next/server";
import { isPositiveIntegerId, proxyToFastAPI } from "@/lib/api-proxy";

// 生成会议纪要
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { meetingId } = body;

  if (!isPositiveIntegerId(meetingId)) {
    return NextResponse.json(
      { success: false, error: "会议ID是必填项" },
      { status: 400 }
    );
  }

  // 转发请求体到后端
  const response = await proxyToFastAPI(request, `/api/meetings/${meetingId}/summarize`, "POST");

  // 安全解析响应体
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "服务器返回了无效响应" },
      { status: 502 }
    );
  }

  if (!response.ok) {
    const detail = (data as Record<string, unknown>)?.detail;
    return NextResponse.json(
      { success: false, error: typeof detail === "string" ? detail : "生成会议纪要失败" },
      { status: response.status }
    );
  }

  return NextResponse.json({ success: true, data });
}
